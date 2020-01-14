class Ships {
  float r;    // radius
  color c;  // color
  float x, y; // location

  Ships(float tempR1) {
    r = tempR1;
    c = color(50, 100, 50, 10);
    x = mouseX;
    y = mouseY;
  }

  void setLocation(float tempX, float tempY) {
    x = tempX;
    y = tempY;
  }

  void display() {
    stroke(1);
    fill(c);
    ellipse(x, y, r*2, r*2);
  }

  // A function that returns true or false based on
  // if the catcher intersects an ellipse
  boolean intersect(Enemy d) {
    // Calculate distance
    float distance = dist(x, y, d.x, d.y); 

    // Compare distance to sum of radii
    if (distance < r + d.r) { 
      return true;
    } else {
      return false;
    }
  }
}
