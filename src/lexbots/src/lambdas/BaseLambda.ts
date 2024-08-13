export abstract class BaseLambda {
  constructor() {
    // This was using IOT to inject dependencies on the constructor
  }

  protected handleBaseError(e: any): Promise<any> {
    console.error("handleBaseError:e", e);
    throw e;
  }
}
