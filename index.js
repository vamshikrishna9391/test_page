const express = require("express")
const path = require("path")
const bcrypt = require("bcrypt")
const cors = require("cors")
const jwt = require('jsonwebtoken');

const {open} = require("sqlite")
const sqlite3 = require("sqlite3")

const dbPath = path.join(__dirname, "mydb.db");
let db = null;

const app = express();
app.use(express.json())
app.use(cors())

const initializeDBAndServer = async () => {
    try {
      db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
      });
      app.listen(3003, () => {
        console.log("Server Running at http://localhost:3003/");
      });
    } catch (e) {
      console.log(`DB Error: ${e.message}`);
      process.exit(1);
    }
  };
  
  initializeDBAndServer();

app.get("/", (request, response) => {
  response.sendFile("helllo.html", {root:__dirname})
})

app.get("/createuser", (request, response) => {
  response.sendFile("createuser.html", {root:__dirname})
})

app.get("/chatpage", (request, response) => {
  response.sendFile("chat.html", {root:__dirname})
})

app.get("/books/", async (request, response) => {
    const getBooksQuery = `
      SELECT * FROM user;
      `;
    const booksArray = await db.all(getBooksQuery);
    response.send(booksArray);
  });

/*
    ++=====================================================================++
    ||                        User login API                               ||
    ++========================______________===============================++
*/

app.post("/logout", async (request, response) => {
  const {id} = request.body;
  const userActivityStatusQuery = `UPDATE user SET is_active = 0 WHERE id = ${id};`
  const dbquery = await db.run(userActivityStatusQuery)
  response.send({id:"", jwtToken:"",username :"", name :"", isActive : 0 });
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send({"user": "Invalid User"})
  } 
  else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "MY_SECRET_TOKEN");
      const userActivityStatusQuery = `UPDATE user SET is_active = 1 WHERE id = ${dbUser.id};`
      
      const dbquery = await db.run(userActivityStatusQuery)

      response.send({id:dbUser.id, jwtToken,username : username, name : dbUser.name, isActive : 1 });
    } 
    else {
      response.status(400);
      response.send({"password":"Invalid Password"})
    }
  }
});

/*
    ++=====================================================================++
    ||                      New user create API                            ||
    ++======================___________________============================++
*/

app.post("/user/", async (request, response) => {
  const {name, username, password, gender} = request.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const getUserQuery = `SELECT username, password FROM user WHERE username = "${username}";`
  const dbUser = await db.get(getUserQuery);

  if(dbUser === undefined){

      const putUserQuery = `INSERT INTO user (name, password, username, gender, location) VALUES ('${name}', '${hashedPassword}', '${username}', '${gender}', 'Karimnagar');`

      const dbResponse = await db.run(putUserQuery);
      const newUserId = dbResponse.lastID;
      response.send({response : `Created new user with user ID : ${newUserId}`});

  }else{
      response.status = 400;
      response.send({response :"User already exists"});    }
})

/*
    ++=====================================================================++
    ||                        User Delete API                              ||
    ++========================_______________==============================++
*/

app.delete("/delete/:userid", async (request, response) => {
  const { userid } = request.params;
  const deleteQuary = `DELETE FROM user WHERE id = ${userid}`

  const bdresponce = await db.run(deleteQuary)
  response.send({response : "User deleted successfully"})
  
});

// To save your message in mes table 
app.post("/sendmessage/", async (request, response) => {
  const {userId, message, toUserId} = request.body
  const putUserQuery = `INSERT INTO mes (user_id, message, to_user_id, time) VALUES ('${userId}', '${message}', '${toUserId}', '${new Date().toLocaleString()}');`
  const dbResponse = await db.run(putUserQuery);
  const newUserId = dbResponse.lastID;  
  response.send({response : `Message sent Successfully`});

});


// To receved messeges from your friends
app.post("/getmessage/", async (request, response) => {
  const {userId, friendUserId} = request.body
  const fetchQuery = `SELECT username FROM user WHERE id = '${userId}'`
  const username = await db.get(fetchQuery);

  // const fetchMsg = `SELECT * FROM mes WHERE (to_user_id = '${userId}' OR user_id = '${friendUserId}');`
  // const fetchMsg = `SELECT * FROM mes WHERE to_user_id = '${userId}'`
  
  const fetchMsg = `
    SELECT 
      * 
    FROM 
      mes 
    WHERE 
        ((user_id = '${friendUserId}') AND (to_user_id = '${userId}'))
      OR	
        ((user_id = '${userId}') AND (to_user_id = '${friendUserId}'));
  `
  
  const messageArray = await db.all(fetchMsg);
  response.send(messageArray);
});

// To Save your friend as your friend
app.post("/savefriend/", async (request, response) => {
  const {userId, friendUserId} = request.body
  const getFriendDataQuery = `SELECT * FROM userfriend WHERE user_id = ${userId} AND user_friend_id = ${friendUserId}`
  const friendData = await db.get(getFriendDataQuery);
  if (friendData === undefined){
    const saveAsFriendQuery = `INSERT INTO userfriend (user_id, user_friend_id) VALUES (${userId}, ${friendUserId});`
    const saveFr = await db.run(saveAsFriendQuery)
    response.send({response: "friend added"})
  }else{
    response.send({response:"You are already friends"})
  }

});

// To serch a friend using friend userName
app.get("/getfriend/:username", async (request, response) => {
  const {username} = request.params
  const getFriendQuery = `SELECT id, name, username FROM user WHERE (username LIKE "%${username}%") OR (name LIKE "%${username}%")`
  const dbResp = await db.all(getFriendQuery)
  if (dbResp !== undefined){
    response.send(dbResp)
  }else{
    response.send({error : "no data found"})
  }
});

// To Get your friends list 
app.get("/getfriends/:id", async (request, response) => {
  const {id} = request.params
  const getfriendsQuery = `SELECT user_friend_id as id FROM userfriend WHERE user_id = ${id};`
  const friendIdsList = await db.all(getfriendsQuery)

  let details = []
  for (let i of friendIdsList){
    const letDetails = `SELECT id, name, username FROM user WHERE id = ${i.id};`
    const data = await db.get(letDetails)
    details.push(data)
  }
  response.send(details)
});



















// app.get("/books/", async (request, response) => {
//     const getBooksQuery = `
//       CREATE TABLE user (
//       id NOT NULL PRIMARY KEY,
//   name VARCHAR(200),
//   age INTEGER
// );`;
//     const booksArray = await db.all(getBooksQuery);
//     response.send("booksArray");
//   });




// INSERT INTO 
// 	mes (user_id, message, to_user_id, time) 
// 	VALUES ('h', 'Hi Vamshi Im fine what about you?', 'vamshi123', '8:00 PM');