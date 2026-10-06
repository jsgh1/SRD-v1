declare module 'pdfmake/build/pdfmake.js' {
  const pdfMake: {
    addVirtualFileSystem(files: Record<string, string>): void;
    createPdf(definition: unknown): { download(filename: string): Promise<void> };
  };
  export default pdfMake;
}

declare module 'pdfmake/build/vfs_fonts.js' {
  const fonts: Record<string, string>;
  export default fonts;
}
