class Enemy {
  float x, y;   // Variables for location of raindrop
  float speed;  // Speed of raindrop
  color c;
  float r;      // Radius of enemy

  Enemy() {
    r = 8;                   // All raindrops are the same size
    x = random(width);       // Start with a random x location
    y = -r*4;                // Start a little above the window
    speed = random(1, 5);    // Pick a random speed
    c = color(random(200), random(10), random(150)); // Color
  }

  // Move the ellipse down
  void move() {
    // Increment by speed
    y += speed;
  }

  // Check if it hits the bottom
  boolean reachedBottom() {
    // If we go a little beyond the bottom
    if (y > height + r*4) { 
      return true;
    } else {
      return false;
    }
  }

  // Display 
  void display() {
    // Display the object
    fill(c);
    noStroke();
    for (int i = 2; i < r; i++ ) {
      //ellipse(x, y + i*4, i*2, i*2);
      ellipse(x, y, i - 40, i - 40);
    }
  }

  // If the ellipse is caught
  void caught() {
    // Stop it from moving by setting speed equal to zero
    speed = 0; 
    // Set the location to somewhere way off-screen
    y = -3000;
  }
}
