// Composition root: wires the independent feature modules together.
// GameLogic and UI stay empty until their owners build them.

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(0);

  GameLogic.init();
  UI.init();

  // Starts in the background so the draw loop can show progress.
  HandPose.init({ maxHands: 2 });
}

function draw() {
  background(0);

  GameLogic.update(HandPose.hands);
  HandPose.draw();
  UI.draw(HandPose.hands, GameLogic.state);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
