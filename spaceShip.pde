class Ship {

  int xpos;
  int ypos;


  //int i = 10;

  Ship( int tempXpos, int tempYpos ) {

    xpos = tempXpos;
    ypos = tempYpos;
  }
  void display() {
    image(Ship, mouseX, mouseY);
    noCursor();
   // frameRate(1000);
  }
}
