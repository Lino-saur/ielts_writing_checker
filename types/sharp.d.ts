declare module "sharp" {
  type SharpPipeline = {
    png(): SharpPipeline;
    toFile(path: string): Promise<unknown>;
  };

  function sharp(input: Buffer | Uint8Array | string): SharpPipeline;

  export default sharp;
}
