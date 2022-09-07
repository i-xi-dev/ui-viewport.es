import { UiUtils } from "@i-xi-dev/ui-utils";

const _VAR_PREFIX = "ixi";

type _ExDocument = Document & {
  adoptedStyleSheets: ReadonlyArray<CSSStyleSheet>,
};

type _ExCSSStyleSheet = CSSStyleSheet & {
  replaceSync: (text: string) => void,
};

const _Axis = {
  X: "x",
  Y: "y",
} as const;
type _Axis = typeof _Axis[keyof typeof _Axis];

function _cssPageVar(pointerType: UiUtils.PointerType, axis: _Axis): string {
  return `--${_VAR_PREFIX}-page-${pointerType}-${axis}`;
}

function _cssViewportVar(pointerType: UiUtils.PointerType, axis: _Axis): string {
  return `--${_VAR_PREFIX}-viewport-${pointerType}-${axis}`;
}






type ViewportMetrics = {
  width: number,
  height: number,
};

type VisualViewportMetrics = ViewportMetrics & {
  offsetX: number,
  offsetY: number,
  scale: number,
};

type Coord = {
  x: number,
  y: number,
};



type PointerDownListener = ({ x, y }: Coord) => void | Promise<void>;

let _singleton: Viewport | null = null;

class Viewport {
  #view: Window;
  #cssRule: CSSStyleRule;
  #pointerPositions: Record<UiUtils.PointerType, Coord> = Object.freeze({
    [UiUtils.PointerType.MOUSE]: Object.seal({ x: -1000, y: -1000 }),
    [UiUtils.PointerType.PEN]: Object.seal({ x: -1000, y: -1000 }),
    [UiUtils.PointerType.TOUCH]: Object.seal({ x: -1000, y: -1000 }),
  });

  #onPointerDown: PointerDownListener = () => {};



  private constructor(view: Window) {
    this.#view = view;

    const css = new CSSStyleSheet() /* $0X1 Safariが未対応 */ as _ExCSSStyleSheet;
    const cssText = `*:root {
      ${_cssPageVar(UiUtils.PointerType.MOUSE, _Axis.X)}: -1000px;
      ${_cssPageVar(UiUtils.PointerType.MOUSE, _Axis.Y)}: -1000px;
      ${_cssPageVar(UiUtils.PointerType.PEN, _Axis.X)}: -1000px;
      ${_cssPageVar(UiUtils.PointerType.PEN, _Axis.Y)}: -1000px;
      ${_cssPageVar(UiUtils.PointerType.TOUCH, _Axis.X)}: -1000px;
      ${_cssPageVar(UiUtils.PointerType.TOUCH, _Axis.Y)}: -1000px;
      ${_cssViewportVar(UiUtils.PointerType.MOUSE, _Axis.X)}: -1000px;
      ${_cssViewportVar(UiUtils.PointerType.MOUSE, _Axis.Y)}: -1000px;
      ${_cssViewportVar(UiUtils.PointerType.PEN, _Axis.X)}: -1000px;
      ${_cssViewportVar(UiUtils.PointerType.PEN, _Axis.Y)}: -1000px;
      ${_cssViewportVar(UiUtils.PointerType.TOUCH, _Axis.X)}: -1000px;
      ${_cssViewportVar(UiUtils.PointerType.TOUCH, _Axis.Y)}: -1000px;
    }`;
    css.replaceSync(cssText); /* $0X1 Safariが未対応 */
    const doc = this.#view.document as _ExDocument;
    doc.adoptedStyleSheets /* $0X1 Safariが未対応 */ = [...doc.adoptedStyleSheets, css];
    this.#cssRule = css.cssRules[0] as CSSStyleRule;

    const screen = this.#view.screen;

    const visualViewport = this.#view.visualViewport;
    if (visualViewport) {
      visualViewport.addEventListener("resize", () => {
        const metrics = {
          page: {
            width: doc.scrollingElement?.scrollWidth ?? 0,
            height: doc.scrollingElement?.scrollHeight ?? 0,
          },
          viewport: {
            width: this.#view.innerWidth,
            height: this.#view.innerHeight,
            visual: {
              x: 0,
              y: 0,
              width: visualViewport.width,
              height: visualViewport.height,
              scale: visualViewport.scale,
            },
          },
          screen: {
            orientation: screen.orientation.type,
            pixelRatio: this.#view.devicePixelRatio,
          },
        };
      }, UiUtils.ListenerOptions.PASSIVE);
    }
    else {
      throw new Error("TODO");
    }

      
      
      
      
      
      
    this.#view.addEventListener("pointermove", (event: PointerEvent) => {
      if (event.isPrimary !== true) {
        return;
      }

      UiUtils.debounce(() => {
        const pointerType = event.pointerType as UiUtils.PointerType;
        this.#setPagePointerPosition(pointerType, event.pageX, event.pageY);

        (async (pointerType: UiUtils.PointerType) => {
          const { x: pageX, y: pageY } = this.getPagePointerPosition(pointerType);
          const { x: viewportX, y: viewportY } = this.getViewportPointerPosition(pointerType);

          // this.#cssRule.styleMap.set(_cssPageVar(pointerType, _Axis.X), CSS.px(pageX));  /* $0X2 Safari,Firefoxが未対応 */
          this.#cssRule.style.setProperty(_cssPageVar(pointerType, _Axis.X), `${pageX}px`);
          this.#cssRule.style.setProperty(_cssPageVar(pointerType, _Axis.Y), `${pageY}px`);
          this.#cssRule.style.setProperty(_cssViewportVar(pointerType, _Axis.X), `${viewportX}px`);
          this.#cssRule.style.setProperty(_cssViewportVar(pointerType, _Axis.Y), `${viewportY}px`);
        })(pointerType).catch((reason: any) => {
          console.error(reason);
        });
      }, 100);
    }, UiUtils.ListenerOptions.PASSIVE);

    this.#view.addEventListener("pointerdown", (event: PointerEvent) => {
      if (event.isPrimary !== true) {
        return;
      }

      this.#onPointerDown(event.pageX, event.pageY);
    }, UiUtils.ListenerOptions.PASSIVE);

    Object.freeze(this);
  }

  static get(): Viewport | null {
    if (window instanceof Window) {
      if ((_singleton instanceof Viewport) !== true) {
        _singleton = new Viewport(window);
      }
    }
    return _singleton;
  }

  getPagePointerPosition(type: UiUtils.PointerType): Readonly<Coord> {
    const { x: pageX, y: pageY } = this.#pointerPositions[type];
    return Object.freeze({
      x: pageX,
      y: pageY,
    });
  }

  // "viewport": layout viewport
  getViewportPointerPosition(type: UiUtils.PointerType): Readonly<Coord> {
    const { x: pageX, y: pageY } = this.#pointerPositions[type];
    return Object.freeze({
      x: pageX - this.#view.scrollX,
      y: pageY - this.#view.scrollY,
    });
  }

  #setPagePointerPosition(type: UiUtils.PointerType, x: number, y: number): void {
    const coord = this.#pointerPositions[type];
    coord.x = x;
    coord.y = y;
  }






  set onPointerDown(listener: PointerDownListener) {
    this.#onPointerDown = listener;
  }

  //TODO lockOrientation()
  //TODO unlockOrientation()
}
Object.freeze(Viewport);





export { Viewport };
