declare module "compression" {
  import type { RequestHandler } from "express";

  interface CompressionOptions {
    threshold?: number | string;
  }

  export default function compression(options?: CompressionOptions): RequestHandler;
}
