import { UiUtils } from "@i-xi-dev/ui-utils";

const _VAR_PREFIX = "ixi";

const _POINTER_TRACKING_INTERVAL = 100;

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

function _createInitialCss() {
  return `*:root {
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
}

type _PageMetrics = {
  sizeX: number,
  sizeY: number,
};

type _LayoutViewportMetrics = {
  offsetX: number, // from page
  offsetY: number, // from page
  sizeX: number,
  sizeY: number,
};

type _VisualViewportMetrics = {
  offsetX: number, // from layout viewport
  offsetY: number, // from layout viewport
  sizeX: number,
  sizeY: number,
  scale: number,
};

type ViewportOptions = {
  pointerTracking?: boolean,
};

function _getMetrics(view: Window): {
  page: _PageMetrics,
  layoutViewport: _LayoutViewportMetrics,
  visualViewport: _VisualViewportMetrics,
} {
  const screen = view.screen;
  const rootScrollingElement = view.document.scrollingElement;
  const visualViewport = view.visualViewport;
  return {
    page: {
      sizeX: rootScrollingElement?.scrollWidth ?? 0,
      sizeY: rootScrollingElement?.scrollHeight ?? 0,
    },
    layoutViewport: {
      offsetX: rootScrollingElement?.scrollTop ?? 0,
      offsetY: rootScrollingElement?.scrollLeft ?? 0,
      sizeX: view.innerWidth,
      sizeY: view.innerHeight,
    },
    visualViewport: {
      offsetX: visualViewport?.offsetLeft ?? 0, // 
      offsetY: visualViewport?.offsetTop ?? 0,
      sizeX: visualViewport?.width ?? 0,
      sizeY: visualViewport?.height ?? 0,
      scale: visualViewport?.scale ?? 1,
    },
  };
}

type _PointerPosition = {
  pageX: number,
  pageY: number,
  layoutViewportX: number,
  layoutViewportY: number,
};
function _newPointerPosition(): _PointerPosition {
  return {
    pageX: -1000,
    pageY: -1000,
    layoutViewportX: -1000,
    layoutViewportY: -1000,
  };
}

type PointerDownListener = (pointerPosition: _PointerPosition) => void | Promise<void>;

type AddPointerDownListenerOptions = {
  once?: boolean,
  signal?: AbortSignal,
};

let _singleton: Viewport | null = null;

/**
 * The Layout viewport and the visual viewport.
 */
class Viewport {
  /**  */
  #view: Window;


  #styleRule: CSSStyleRule | null;

  #pointerDownListeners: Set<{ listener: PointerDownListener, options: AddPointerDownListenerOptions }>;

  #pageDs: _PageMetrics;

  #layoutDs: _LayoutViewportMetrics;


  #visualDs: _VisualViewportMetrics;

  #pointerPositions: Record<UiUtils.PointerType, _PointerPosition>;
  //TODO touchPositions


  /**
   * 
   * @param view 
   */
  private constructor(view: Window, options: ViewportOptions = {}) {
    this.#view = view;
    const doc = this.#view.document as _ExDocument;

    if (options?.pointerTracking === true) {
      const css = new CSSStyleSheet() /* $0X1 Safariが未対応 */ as _ExCSSStyleSheet;
      css.replaceSync(_createInitialCss()); /* $0X1 Safariが未対応 */
      doc.adoptedStyleSheets /* $0X1 Safariが未対応 */ = [...doc.adoptedStyleSheets, css];
      this.#styleRule = css.cssRules[0] as CSSStyleRule;

      this.#pointerPositions = Object.freeze({
        [UiUtils.PointerType.MOUSE]: Object.seal(_newPointerPosition()),
        [UiUtils.PointerType.PEN]: Object.seal(_newPointerPosition()),
        [UiUtils.PointerType.TOUCH]: Object.seal(_newPointerPosition()),
      });
    }
    else {
      this.#styleRule = null;
    }

    this.#pointerDownListeners = new Set();

    const { page, layoutViewport, visualViewport } = _getMetrics(this.#view);
    this.#pageDs = page;
    this.#layoutDs = layoutViewport;
    this.#visualDs = visualViewport;

    this.#view.addEventListener("pointermove", (event: PointerEvent) => {
      if (options?.pointerTracking === true) {
        if (event.isPrimary !== true) {
          return;
        }

        UiUtils.debounce(() => {
          this.#onPointerMove(event.pointerType as UiUtils.PointerType, event.pageX, event.pageY);
        }, _POINTER_TRACKING_INTERVAL);
      }
    }, UiUtils.ListenerOptions.PASSIVE);

    this.#view.addEventListener("pointerdown", (event: PointerEvent) => {
      if (options?.pointerTracking === true) {
        if (event.isPrimary !== true) {
          return;
        }

        //this.#onPointerMove(event.pointerType as UiUtils.PointerType, event.pageX, event.pageY);

        const pointerPosition = {
          pageX: event.pageX,
          pageY: event.pageY,
          layoutViewportX: event.pageX - this.#view.scrollX,
          layoutViewportY: event.pageY - this.#view.scrollY,
        };
        for (const registered of this.#pointerDownListeners.values()) {
          if (registered.options.once === true) {
            this.#pointerDownListeners.delete(registered);
          }
          registered.listener(Object.assign({}, pointerPosition));
        }
      }
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

  #onPointerMove(pointerType: UiUtils.PointerType, pageX: number, pageY: number): void {
    const pointerPosition = this.#pointerPositions[pointerType];
    pointerPosition.pageX = pageX;
    pointerPosition.pageY = pageY;
    pointerPosition.layoutViewportX = pageX - this.#view.scrollX;
    pointerPosition.layoutViewportY = pageY - this.#view.scrollY;

    (async (pointerType: UiUtils.PointerType) => { //TODO
      if (this.#styleRule) {
        const { pageX, pageY, layoutViewportX, layoutViewportY } = this.#pointerPositions[pointerType];
        // this.#cssRule.styleMap.set(_cssPageVar(pointerType, _Axis.X), CSS.px(pageX));  /* $0X2 Safari,Firefoxが未対応 */
        this.#styleRule.style.setProperty(_cssPageVar(pointerType, _Axis.X), `${pageX}px`);
        this.#styleRule.style.setProperty(_cssPageVar(pointerType, _Axis.Y), `${pageY}px`);
        this.#styleRule.style.setProperty(_cssViewportVar(pointerType, _Axis.X), `${layoutViewportX}px`);
        this.#styleRule.style.setProperty(_cssViewportVar(pointerType, _Axis.Y), `${layoutViewportY}px`);
      }
    })(pointerType).catch((reason: any) => {
      console.error(reason); //TODO
    });
  }


  addPointerDownListener(listener: PointerDownListener, options: AddPointerDownListenerOptions = {}): void {
    const target = { listener, options };
    if (options.signal instanceof AbortSignal) {
      if (options.signal.aborted === true) {
        return;
      }
      else {
        options.signal.addEventListener("abort", () => {
          this.#pointerDownListeners.delete(target);
        }, { once: true, passive: true });
      }
    }
    this.#pointerDownListeners.add(target);
  }

  //TODO lockOrientation()
  //TODO unlockOrientation()
}
Object.freeze(Viewport);










//TODO

//     const visualViewport = this.#view.visualViewport;
//     if (visualViewport) {
//       visualViewport.addEventListener("resize", () => {
//         const metrics = {
//           screen: {
//             orientation: screen.orientation.type,
//             pixelRatio: this.#view.devicePixelRatio,
//           },
//         };
//       }, UiUtils.ListenerOptions.PASSIVE);
//     }
//     else {
//       throw new Error("TODO");
//     }


export { Viewport };
