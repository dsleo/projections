declare module 'pdfjs-dist/legacy/build/pdf' {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    // Minimal declaration to satisfy TypeScript / Next build.
    // We load PDF.js dynamically at runtime; detailed typing isn't required here.
    const pdfjs: any;
    export default pdfjs;
    export const GlobalWorkerOptions: any;
    export function getDocument(...args: any[]): any;
    /* eslint-enable @typescript-eslint/no-explicit-any */
}
