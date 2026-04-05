import PostureDetector from "./PostureDetector";

let sharedDetector: PostureDetector | null = null;
let initPromise: Promise<PostureDetector> | null = null;

export function getSharedPostureDetector(): PostureDetector | null {
  return sharedDetector;
}

export function isSharedPostureDetectorReady(): boolean {
  return sharedDetector !== null;
}

export async function preloadSharedPostureDetector(): Promise<PostureDetector> {
  if (sharedDetector) {
    return sharedDetector;
  }

  if (initPromise) {
    return initPromise;
  }

  const detector = new PostureDetector();
  initPromise = detector
    .init()
    .then(() => {
      sharedDetector = detector;
      return detector;
    })
    .catch((error) => {
      detector.destroy();
      throw error;
    })
    .finally(() => {
      initPromise = null;
    });

  return initPromise;
}
