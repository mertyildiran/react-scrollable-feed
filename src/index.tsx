import * as React from 'react'
import { ReactNode } from 'react';
import styles from './styles.css'

const buffer = 3;

export type ScrollableFeedProps = {
  itemHeight: number;
  marginTop: number;
  animateScroll?: (element: HTMLElement, offset: number) => void;
  onScrollComplete?: () => void;
  changeDetectionFilter?: (previousProps: ScrollableFeedComponentProps, newProps: ScrollableFeedComponentProps) => boolean;
  viewableDetectionEpsilon?: number;
  className?: string;
  onScroll?: (isAtBottom: boolean) => void;
}

type ScrollableFeedComponentProps = Readonly<{ children?: ReactNode }> & Readonly<ScrollableFeedProps>;

class ScrollableFeed extends React.Component<ScrollableFeedProps> {
  private readonly wrapperRef: React.RefObject<HTMLDivElement>;
  private readonly topRef: React.RefObject<HTMLDivElement>;
  private readonly bottomRef: React.RefObject<HTMLDivElement>;
  private forceScroll: boolean;
  private skipForceScroll: boolean;
  private endIndex: number;
  private startIndexOverride: number;
  private endIndexOverride: number;

  constructor(props: ScrollableFeedProps) {
    super(props);
    this.wrapperRef = React.createRef();
    this.topRef = React.createRef();
    this.bottomRef = React.createRef();
    this.handleScroll = this.handleScroll.bind(this);
    this.forceScroll = true;
    this.skipForceScroll = false;
    this.startIndexOverride = 0;
    this.endIndexOverride = 0;
  }

  static defaultProps: ScrollableFeedProps = {
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
    changeDetectionFilter: () => true,
    viewableDetectionEpsilon: 2,
    onScroll: () => {},
  };

  getSnapshotBeforeUpdate(): boolean {
    if (this.wrapperRef.current && this.bottomRef.current) {
      const { viewableDetectionEpsilon } = this.props;
      return ScrollableFeed.isViewable(this.wrapperRef.current, this.bottomRef.current, viewableDetectionEpsilon!); //This argument is passed down to componentDidUpdate as 3rd parameter
    }
    return false;
  }

  componentDidUpdate(previousProps: ScrollableFeedComponentProps, {}: any): void {
    const { changeDetectionFilter } = this.props;
    const isValidChange = changeDetectionFilter!(previousProps, this.props);
    if (!this.skipForceScroll) {
      if (isValidChange && !this.skipForceScroll && this.forceScroll) {
        this.scrollToBottom();
      }
    } else {
      this.skipForceScroll = false;
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
    if (!ScrollableFeed.isViewable(parent, child, viewableDetectionEpsilon!)) {
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
   * Fires the onScroll event, sending isAtBottom boolean as its first parameter
   */
  protected handleScroll(): void {
    this.forceUpdate();
    const { children, onScroll } = this.props;
    const childrenRef = children ? children[1] : null;
    if (onScroll && this.endIndex >= (childrenRef.length - 1)) {
      this.forceScroll = true;
      this.skipForceScroll = true;
      onScroll(true);
    } else {
      this.forceScroll = false;
    }
  }

  /**
   * Scroll to the bottom
   */
  public scrollToBottom(): void {
    this.forceScroll = true;
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

    this.endIndex = endIndex;

    const items = [];

    for (let i = startIndex; i <= endIndex; i++) {
      var item = childrenRef[i];
      item.props.style['top'] = `${i * actualHeight}px`;
      item.props.style['marginTop'] = `${marginTop}px`;
      items.push(
        item
      );
    }

    const joinedClassName = styles.scrollableDiv + (className ? " " + className : "");
    return (
      <div className={joinedClassName} ref={this.wrapperRef} onScroll={this.handleScroll}>
        <div ref={this.topRef}></div>
        {items}
        <div ref={this.bottomRef}></div>
      </div>
    );
  }
}

export default ScrollableFeed;
