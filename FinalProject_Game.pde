/*Hunter Monaghan //<>//
 Graphic Desgin 
 Final_Game*/

/***************** DESCRIPTION OF GAME ***********************/
/* my inspiration of this project comes from most 2d games I played when I was a kid.
 I have always like the space games and open-world traveling around games. 
 So while making this game, I decided to put a galaga look into it and the enemys will be asteroids like the game called asteroids. 
 They will be a PShape asteroid that is transparent and the mission of the game is to survive from the incoming asteroids from shooting your way out!
 Only things I need to do is get enemys showing then shooting down and collision detection to end it! Add in a scoreboard or health or lives*/

//variables
float[] x = new float[100];
float[] y = new float[100];
float[] speed = new float[100];
int points;
endGame end;
int frequency = 4; //frequency of star 
PImage Ship;
int gameScreen = 0; //this will order my game from start game/content/GameOver 
int initScreen;
int gameOverScreen;
Ships ships;
int mousePressed;
Timer timer;
Enemy[]enemies;
int totalEnemy = 0;


Ship spaceShip;

/********* SETUP BLOCK *********/
void setup() {
  size(1000, 600);
  background(0);
  stroke(255);
  //intializing 
  ships = new Ships(70);
  Ship = loadImage("images/alienShip.png");
  spaceShip = new Ship( mouseX, mouseY);
  enemies = new Enemy[100];    // 1000 enemy array
  timer = new Timer(310);    // timer that goes off every 310 milliseconds
  timer.start();
  points = 0;
  noCursor();

  //Background
  int i = 0;
  while (i < 100) {  
    x[i] = random(0, width);
    y[i] = random(0, height);
    speed[i] = random(1, 5);
    i = i + 1;
  }
}


/********* DRAW BLOCK *********/
void draw() {

  // DISPLAY THE CONTENTS OF THE CURRENT SCREENZ
  if (gameScreen == 0) {
    initScreen();
  } else {
    gameScreen();
  }

  //BACKGROUND
  int i = 0;
  while (i < 100) {
    float co = map(speed[i], 1, 5, 100, 255);
    stroke(co);
    strokeWeight(speed[i]);
    point(x[i], y[i]);

    x[i] = x[i] - speed[i] / 2;
    if (x[i] < 0) {
      x[i] = width;
    }
    i = i + 1;
  }

  // ships catchers location
  ships.setLocation(mouseX + 60, mouseY + 20);
  //display the Ship's catcher
  ships.display();

  // timer
  if (timer.isFinished()) {
    // Deal with enemys
    // Initialize one enemy
    enemies[totalEnemy] = new Enemy();
    // Increment totalDrops
    totalEnemy ++ ;
    // If we hit the end of the array
    if (totalEnemy >= enemies.length) {
      totalEnemy = 0; // Start over
    }
    timer.start();
  }
}

/*

 //SHOOTING 
 if (keyPressed == true) {
 //x += (speed * dX);
 //y += (speed * dY);
 x=x+(speed*dX);
 y=y+(speed*dY);
 }
 
 */


/********* SCREEN CONTENTS *********/
void initScreen() {
  //CLICK TO START --> TEXT
  background(0);
  fill(255);
  //fill(random(20, 100), random(200, 0)); CLICK HERE BLINKING
  textAlign(CENTER);
  textSize(50);
  text("Click To Play", height/3 + 300, width/3);
  fill(0, 0, 250);
  textAlign(BOTTOM);
  textSize(25);
  text(" Made By: Hunter Monagahan", height/2 + 25, width/2);





  //Stars
  fill(0, 20);
  rect(0, 0, width, height);
  fill(255);
  ellipse(random(width), random(height), 4, 4);
}
//STARTING THE GAME
void gameScreen() {
  // codes of game screen
  background(0);
  //OTHER 
  if (end != null) {
    end.drawEndScene();
  } else { 
    background(0);
    //drawSpace();


    fill(255, 0, 0);
    stroke(255);



    stroke(255);
    fill(255);
    textAlign(LEFT);
    textSize(30);
    text("Points: " + points, 50, 50);
    points += 1;
  }

  // Check the timer
  if (timer.isFinished()) {
    // Deal with Enemy
    // Initialize one Enemy
    enemies[totalEnemy] = new Enemy();
    // Increment totalEnemy
    totalEnemy ++ ;
    // If we hit the end of the array
    if (totalEnemy >= enemies.length) {
      totalEnemy = 0; // Start over
    }
    timer.start();
  } 

  // Move and display all Enemy
  for (int i = 0; i < totalEnemy; i++ ) {
    enemies[i].move();
    enemies[i].display();
    if (ships.intersect(enemies[i])) {
      enemies[i].caught();
    }
    spaceShip.display();
    //space.display();
    //spaceship.shoot();
  }
}

/********* INPUTS *********/

// CODES OF INITIAL SCREEN
void mousePressed() {
  // if we are on the initial screen when clicked, start the game
  if (gameScreen==0) {
    startGame();
  }
}
/*void keyPressed() {
 if (key == " "){
 a =+ ( keyPressed );
 
 }*/



/********* OTHER FUNCTIONS *********/

void startGame() {
  gameScreen=1;
}
