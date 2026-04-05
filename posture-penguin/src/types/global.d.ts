// Type declarations for CSS modules
declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.css" {
  const content: string;
  export default content;
}

// Type declarations for MediaPipe
declare module "@mediapipe/pose" {
  export interface PoseOptions {
    modelComplexity?: 0 | 1 | 2;
    smoothLandmarks?: boolean;
    enableSegmentation?: boolean;
    smoothSegmentation?: boolean;
    minDetectionConfidence?: number;
    minTrackingConfidence?: number;
  }

  export interface LandmarkPoint {
    x: number;
    y: number;
    z: number;
    visibility?: number;
  }

  export interface Results {
    poseLandmarks?: LandmarkPoint[];
    poseWorldLandmarks?: LandmarkPoint[];
    segmentationMask?: HTMLCanvasElement;
    image: HTMLCanvasElement | HTMLVideoElement;
  }

  export interface Pose {
    setOptions(options: PoseOptions): void;
    onResults(callback: (results: Results) => void): void;
    send(input: { image: HTMLCanvasElement | HTMLVideoElement }): Promise<void>;
    close(): void;
  }

  export interface PoseConstructor {
    new (config?: { locateFile?: (file: string) => string }): Pose;
  }

  const Pose: PoseConstructor;
  export default Pose;
}

declare module "@mediapipe/camera_utils" {
  export class Camera {
    constructor(
      videoElement: HTMLVideoElement,
      config: {
        onFrame: () => Promise<void>;
        width: number;
        height: number;
      },
    );
    start(): Promise<void>;
    stop(): void;
  }
}

declare module "@mediapipe/drawing_utils" {
  export function drawConnectors(
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    connections: any,
    style?: { color: string; lineWidth: number },
  ): void;

  export function drawLandmarks(
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    style?: { color: string; lineWidth: number; radius: number },
  ): void;

  export const POSE_CONNECTIONS: Array<[number, number]>;
}
