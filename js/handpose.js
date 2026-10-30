/**
 * HandPose module — owns the webcam, ml5 hand detection and the hand
 * skeleton renderer. Exposes the detected hands for GameLogic and UI.
 *
 * Contract:
 *   HandPose.init({ maxHands })   // async, starts in the background
 *   HandPose.hands -> [{ keypoints: [{ x, y, ... }], handedness }]
 *   HandPose.draw() -> renders sticks + joint circles (no video frame)
 *
 * Append ?debug=1 to the URL to see backend, camera and detection stats.
 */
const HandPose = {
  model: null,
  video: null,
  hands: [],
  ready: false,
  error: null,
  backend: null,
  detections: 0,
  debug: new URLSearchParams(window.location.search).has("debug"),

  // MediaPipe hand landmark connections: 21 keypoints per hand.
  connections: [
    [0, 1], [1, 2], [2, 3], [3, 4],           // thumb
    [0, 5], [5, 6], [6, 7], [7, 8],           // index
    [5, 9], [9, 10], [10, 11], [11, 12],      // middle
    [9, 13], [13, 14], [14, 15], [15, 16],    // ring
    [13, 17], [17, 18], [18, 19], [19, 20],   // pinky
    [0, 17],                                  // palm base
  ],

  async init({ maxHands = 2 } = {}) {
    if (this.ready) return;

    try {
      if (typeof ml5 === "undefined") {
        throw new Error("ml5.js is not loaded");
      }

      // The WebGPU backend returns empty hand detections on some Windows
      // GPUs. WebGL is the stable path for handPose.
      ml5.setBackend("webgl");
      await ml5.tf.ready();
      this.backend = ml5.tf.getBackend();

      // If WebGL is unavailable, slow CPU inference is better than silence.
      if (this.backend === "webgpu") {
        ml5.setBackend("cpu");
        await ml5.tf.ready();
        this.backend = ml5.tf.getBackend();
        console.warn("[HandPose] WebGL unavailable, falling back to CPU");
      }

      this.video = await this.startCamera();
      this.model = await ml5.handPose({ maxHands, flipped: true });
      this.model.detectStart(this.video, (results) => {
        this.hands = results || [];
        this.detections++;
      });
      this.ready = true;

      console.info(
        `[HandPose] ready · backend ${this.backend} · ` +
          `${this.video.videoWidth}x${this.video.videoHeight}`
      );
    } catch (error) {
      this.error = error;
      this.hands = [];
      console.error("[HandPose]", error);
    }
  },

  async startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
    });

    const video = document.createElement("video");
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.style.display = "none";
    document.body.appendChild(video);
    video.srcObject = stream;

    await new Promise((resolve, reject) => {
      if (video.readyState >= 1) {
        resolve();
        return;
      }
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("Camera stream could not be loaded"));
    });

    await video.play();
    return video;
  },

  draw() {
    push();

    if (this.error) {
      this.drawStatus(
        `Hand tracking unavailable: ${
          this.error.message || this.error.name || "unknown error"
        }`,
        [255, 90, 90]
      );
    } else if (!this.ready) {
      const camera = this.video
        ? `Camera ${this.video.videoWidth}x${this.video.videoHeight}`
        : "Requesting camera...";
      this.drawStatus(`Starting hand tracking... ${camera}`, [160]);
    } else if (this.hands.length === 0) {
      this.drawStatus("Show your hand to the camera", [130]);
    } else {
      const mapping = this.getMapping();
      for (const hand of this.hands) {
        const points = hand.keypoints.map((point) => this.toCanvas(point, mapping));
        this.drawHand(points);
      }
    }

    if (this.debug) this.drawDebug();

    pop();
  },

  drawStatus(message, color) {
    noStroke();
    fill(color[0], color[1] ?? color[0], color[2] ?? color[0]);
    textSize(16);
    textAlign(CENTER, CENTER);
    text(message, width / 2, height / 2);
  },

  // Cover mapping: fill the canvas without distortion, centered.
  getMapping() {
    const videoWidth = this.video.videoWidth || 640;
    const videoHeight = this.video.videoHeight || 480;
    const scale = Math.max(width / videoWidth, height / videoHeight);

    return {
      scale,
      offsetX: (width - videoWidth * scale) / 2,
      offsetY: (height - videoHeight * scale) / 2,
    };
  },

  toCanvas(point, mapping) {
    return {
      x: point.x * mapping.scale + mapping.offsetX,
      y: point.y * mapping.scale + mapping.offsetY,
    };
  },

  drawHand(points) {
    stroke(0, 255, 180);
    strokeWeight(3);
    noFill();
    for (const [a, b] of this.connections) {
      line(points[a].x, points[a].y, points[b].x, points[b].y);
    }

    fill(8);
    stroke(0, 255, 180);
    strokeWeight(2);
    for (const point of points) {
      circle(point.x, point.y, 12);
    }
  },

  drawDebug() {
    const camera = this.video
      ? `${this.video.videoWidth}x${this.video.videoHeight} @ ${this.video.currentTime.toFixed(1)}s`
      : "none";
    const lines = [
      `backend: ${this.backend ?? "unknown"}`,
      `camera: ${camera}`,
      `ready: ${this.ready}`,
      `hands: ${this.hands.length}`,
      `detections: ${this.detections}`,
    ];

    noStroke();
    fill(0, 220, 255);
    textSize(12);
    textAlign(LEFT, TOP);
    text(lines.join("\n"), 12, 12);

    // Small camera preview, mirrored like the canvas. Debug only.
    if (this.video && this.video.readyState >= 2) {
      const previewWidth = 160;
      const previewHeight = 120;
      const x = width - previewWidth - 12;
      const y = 12;

      drawingContext.save();
      drawingContext.translate(x + previewWidth, y);
      drawingContext.scale(-1, 1);
      drawingContext.drawImage(this.video, 0, 0, previewWidth, previewHeight);
      drawingContext.restore();
    }
  },
};
