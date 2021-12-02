import * as React from 'react'
import styles from './styles.css'

const buffer = 3;

export type ScrollableFeedVirtualizedProps = {
  itemHeight: number;
  marginTop: number;
  animateScroll?: (element: HTMLElement, offset: number) => void;
  onScrollComplete?: () => void;
  viewableDetectionEpsilon?: number;
  className?: string;
  onSnapBroken?: () => void; // Called in case of scrollbar is not snapped to the bottom
  scrollBarHorizontalGap?: number;
}

class ScrollableFeedVirtualized extends React.Component<ScrollableFeedVirtualizedProps> {
  private readonly wrapperRef: React.RefObject<HTMLDivElement>;
  private readonly childWrapperRef: React.RefObject<HTMLDivElement>;
  private readonly topRef: React.RefObject<HTMLDivElement>;
  private readonly bottomRef: React.RefObject<HTMLDivElement>;
  private forceScroll: boolean;
  private startIndexOverride: number;
  private endIndexOverride: number;

  constructor(props: ScrollableFeedVirtualizedProps) {
    super(props);
    this.wrapperRef = React.createRef();
    this.childWrapperRef = React.createRef();
    this.topRef = React.createRef();
    this.bottomRef = React.createRef();
    this.handleScroll = this.handleScroll.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleMouseWheel = this.handleMouseWheel.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.forceScroll = true;
    this.startIndexOverride = 0;
    this.endIndexOverride = 0;
  }

  static defaultProps: ScrollableFeedVirtualizedProps = {
    itemHeight: 0,
    marginTop: 0,
    animateScroll: (element: HTMLElement, offset: number): void => {
      if (element.scrollBy) {
        element.scrollBy({ top: offset });
      }
      else {
        element.scrollTop = offset;
      }
    },
    onScrollComplete: () => {},
    viewableDetectionEpsilon: 2,
    onSnapBroken: () => {},
  };

  getSnapshotBeforeUpdate(): boolean {
    if (this.wrapperRef.current && this.bottomRef.current) {
      const { viewableDetectionEpsilon } = this.props;
      return ScrollableFeedVirtualized.isViewable(this.wrapperRef.current, this.bottomRef.current, viewableDetectionEpsilon!); //This argument is passed down to componentDidUpdate as 3rd parameter
    }
    return false;
  }

  componentDidUpdate({}: any): void {
    if (this.forceScroll) {
      this.scrollToBottom();
    }
  }

  componentDidMount(): void {
    this.scrollToBottom();
  }

  /**
   * Scrolls a parent element such that the child element will be in view
   * @param parent
   * @param child
   */
  protected scrollParentToChild(parent: HTMLElement, child: HTMLElement): void {
    const { viewableDetectionEpsilon } = this.props;
    if (!ScrollableFeedVirtualized.isViewable(parent, child, viewableDetectionEpsilon!)) {
      //Source: https://stackoverflow.com/a/45411081/6316091
      const parentRect = parent.getBoundingClientRect();
      const childRect = child.getBoundingClientRect();

      //Scroll by offset relative to parent
      const scrollOffset = (childRect.top + parent.scrollTop) - parentRect.top;
      const { animateScroll, onScrollComplete } = this.props;
      if (animateScroll) {
        animateScroll(parent, scrollOffset);
        onScrollComplete!();
      }
    }
  }

  /**
   * Returns whether a child element is visible within a parent element
   *
   * @param parent
   * @param child
   * @param epsilon
   */
  private static isViewable(parent: HTMLElement, child: HTMLElement, epsilon: number): boolean {
    epsilon = epsilon || 0;

    //Source: https://stackoverflow.com/a/45411081/6316091
    const parentRect = parent.getBoundingClientRect();
    const childRect = child.getBoundingClientRect();

    const childTopIsViewable = (childRect.top >= parentRect.top);

    const childOffsetToParentBottom = parentRect.top + parent.clientHeight - childRect.top;
    const childBottomIsViewable = childOffsetToParentBottom + epsilon >= 0;

    return childTopIsViewable && childBottomIsViewable;
  }

  /**
   * Handles the keyDown event, sets forceScroll to false if it's PageUp or ArrowUp
   */
  protected handleKeyDown(e: any): void {
    const { onSnapBroken } = this.props;
    switch (e.keyCode) {
      case 33: // PageUp
      case 38: // ArrowUp
        this.forceScroll = false;
        onSnapBroken!();
        break;
      case 145: // ScrollLock
        this.forceScroll = !this.forceScroll;
        onSnapBroken!();
        break;
      default:
        break;
    }
  }

  /**
   * Handles the mouse wheel event, sets forceScroll to false
   */
  protected handleMouseWheel(): void {
    const { onSnapBroken } = this.props;
    this.forceScroll = false;
    onSnapBroken!();
  }

  /**
   * Handles the mouse down event, sets forceScroll to false
   */
  protected handleMouseDown(e: any): void {
    const { scrollBarHorizontalGap, onSnapBroken } = this.props;
    const gap = scrollBarHorizontalGap ? scrollBarHorizontalGap : 16;
    if (this.wrapperRef.current === e.target && (e.clientX - gap) >= e.target.clientWidth) {
      this.forceScroll = false;
      onSnapBroken!();
    }
  }

  /**
   * Handles the onScroll event, forces render
   */
  protected handleScroll(): void {
    this.forceUpdate();
  }

  /**
   * Scroll to the bottom
   */
  public scrollToBottom(): void {
    if (this.wrapperRef.current) {
      const parent = this.wrapperRef.current;
      const { animateScroll, onScrollComplete, children, itemHeight } = this.props;
      const childrenRef = children ? children[1] : null;
      if (animateScroll && parent) {
        animateScroll(parent, (childrenRef.length + buffer) * itemHeight);
        onScrollComplete!();
      }
    }
  }

  /**
   * Scroll to a certain start index
   */
  public scrollToIndex(startIndex: number): void {
    const { itemHeight, marginTop, animateScroll, onScrollComplete } = this.props;
    if (this.wrapperRef.current) {
      const parent = this.wrapperRef.current;
      const upperParent = this.wrapperRef.current.parentElement;
      if (upperParent) {
        const upperParentRect = upperParent.getBoundingClientRect();
        var windowHeight = upperParentRect.height;
        const actualHeight = itemHeight + marginTop;

        if (animateScroll && parent) {
          animateScroll(parent, (startIndex + Math.floor(windowHeight / actualHeight) + 2 * buffer) * itemHeight);
          onScrollComplete!();
        }
      }
    }
  }

  /**
   * Jump to the bottom
   */
  public jumpToBottom(): void {
    const { children, itemHeight, marginTop } = this.props;
    const childrenRef = children ? children[1] : null;
    if (this.wrapperRef.current) {
      const upperParent = this.wrapperRef.current.parentElement;
      if (upperParent) {
        const upperParentRect = upperParent.getBoundingClientRect();
        var windowHeight = upperParentRect.height;
        const actualHeight = itemHeight + marginTop;

        this.startIndexOverride = childrenRef.length - Math.floor(windowHeight / actualHeight) - buffer;
        this.endIndexOverride = childrenRef.length - 1;
        this.forceUpdate();
        this.forceScroll = true;
        this.scrollToBottom();
      }
    }
  }

  render(): React.ReactNode {
    const { children, className, itemHeight, marginTop } = this.props;
    const childrenRef = children ? children[1] : null;
    if (!childrenRef) {
      return <></>;
    }

    var windowHeight = 0;
    var windowTop = 0;

    if (this.wrapperRef.current) {
      const upperParent = this.wrapperRef.current.parentElement;
      if (upperParent) {
        const upperParentRect = upperParent.getBoundingClientRect();
        windowHeight = upperParentRect.height;
        windowTop = upperParentRect.top;

        const { animateScroll, onScrollComplete } = this.props;
        if (animateScroll && upperParent) {
          animateScroll(upperParent, (childrenRef.length + buffer) * itemHeight);
          onScrollComplete!();
        }
      }
    }

    const numItems = children ? children[1].length : 0;
    var top = 0;

    if (this.topRef.current) {
      const topRect = this.topRef.current.getBoundingClientRect();
      if (topRect.top < windowTop) {
        top = windowTop - topRect.top;
      }
    }

    const actualHeight = itemHeight + marginTop;
    var startIndex = Math.floor(top / actualHeight);
    var endIndex = Math.min(
      numItems - 1, // don't render past the end of the list
      Math.floor((top + windowHeight) / actualHeight)
    );

    startIndex -= buffer;
    endIndex += buffer;

    if (startIndex < 0) {
      startIndex = 0;
    }

    if (this.startIndexOverride > 0) {
      startIndex = this.startIndexOverride;
      this.startIndexOverride = 0;
    }

    if (this.endIndexOverride > 0) {
      endIndex = this.endIndexOverride;
      this.endIndexOverride = 0;
    }

    if (endIndex > (childrenRef.length - 1)) {
      endIndex = (childrenRef.length - 1);
    }

    const items = [];

    for (let i = startIndex; i <= endIndex; i++) {
      var item = childrenRef[i];
      item.props.style['top'] = `${i * actualHeight}px`;
      item.props.style['marginTop'] = `${marginTop}px`;
      items.push(
        item
      );
    }

    const childWrapperHeight = actualHeight * numItems;

    const joinedClassName = styles.scrollableDiv + (className ? " " + className : "");
    return (
      <div
        className={joinedClassName}
        ref={this.wrapperRef}
        onScroll={this.handleScroll}
        onKeyDown={this.handleKeyDown}
        onWheel={this.handleMouseWheel}
        onMouseDown={this.handleMouseDown}
        tabIndex={0}
      >
        <div ref={this.childWrapperRef} style={{height: `${childWrapperHeight}px`}}>
          <div ref={this.topRef}></div>
          {items}
          <div ref={this.bottomRef}></div>
        </div>
      </div>
    );
  }
}

export default ScrollableFeedVirtualized;
