declare module 'katex/contrib/auto-render' {
  const renderMathInElement: (el: HTMLElement, options?: Record<string, unknown>) => void;
  export default renderMathInElement;
}
