const rootURL = "127.0.0.1:5050"

let jwtSecretKey = "Th1sis$ecr3t";
const spreadsheetId = "1_6XbDkCsunE8HQW3nouS9AHyStRrNTJaBqQ6QctXKog"; /* Enter your Sheet ID HERE */
const saltRounds = 5; /* 10-12 for best results */

const keyFilePosition = "credentials.json";
const bcrypt = require('bcrypt');
const express = require("express");
const {google} = require("googleapis");
const dotenv = require('dotenv');

 

dotenv.config();

const jwt = require('jsonwebtoken');

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

/* Functions */


async function InitGoogleSheet() {
    const auth = new google.auth.GoogleAuth({
        keyFile: keyFilePosition,
        scopes: "https://www.googleapis.com/auth/spreadsheets",
    });

    const client = await auth.getClient();

    const googleSheets = google.sheets({version: "v4", auth: client});
    return {auth, googleSheets};
}

async function GetData(dataRange) { // e.g. "Sheet1!A:A"
    const {auth, googleSheets} = await InitGoogleSheet();

    const metaData = await googleSheets.spreadsheets.get({
        auth,
        spreadsheetId,
    });

    const getRows = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: dataRange,
    });
    return getRows.data.values;
}

async function UpdateData(dataRange, dataValues) {
    const {auth, googleSheets} = await InitGoogleSheet();

    await googleSheets.spreadsheets.values.update({
        auth,
        spreadsheetId,
        range: dataRange,
        valueInputOption: "USER_ENTERED",
        resource: {
            values: dataValues,
        },
    });

    
}

function insideGeofenceCallBack(){
    console.log("WE ARE INSIDE THE FENCE!");
  }

async function getCurrentLocation() {
    let items = [
      "Hayward, CA",
      "San Jose, CA",
      "41.43206,-81.38992",
      "San Francisco, CA"
    ];
  
    // Return a random value
    var item = items[Math.floor(Math.random() * items.length)];
    return item;
  }

function CheckPosition() {
let options = {
    // You can get it from here: https://cloud.google.com/maps-platform/
    apiKey: "AIzaSyAt4n8l4OI7f3ZxiD7luN-kSb9f1aDg3q0", // Enter your own api key
    updateInterval: 5,  // Update current location (in seconds)
    
    // API function to get the current location.
    // It should return a string that is an address or lat/long
    // See Google's Distance Matrix API:
    // https://developers.google.com/maps/documentation/distance-matrix/intro
    getCurrentLocation: getCurrentLocation,
    
    // Callback for when we are inside the fence (optional)
    insideGeofenceCallBack: insideGeofenceCallBack,
    
    // Callback function to be called whenever the 
    // current location and distance is updated (optional)
    // updateDistanceCallBack: updateDistanceCallBack,
    
    loopForever: false,  // Stop/continue once we are inside the fence
    
    activateFenceOn: "duration", // 'duration' OR 'distance' OR 'either'
    fenceDurationValue: 25 * 60, // range of the fence in seconds
    fenceDistanceValue: 1000, // range of the fence in meters
    };
    
    let locationSepc = {
    destination: "Oakland, CA", // Can be address or lat/long
    mode: "driving" //
    };

    var geofence = require("geofence")(options, locationSepc);

    geofence.start(options);
      
}
/* Get Views */

app.get("/", (req, res) => {
    res.render("index");
});


app.get("/geo", async (req, res) => {
    CheckPosition();
});

app.get("/form", async (req, res) => {
    res.render("form");
});

app.get("/delete", async (req, res) => {
    const tableID = req.query.tableID;
    const rowID = parseInt(tableID) + 1;
    UpdateData(`Sheet1!${rowID}:${rowID}`, [[tableID, "Empty", 0, 0, ""]]);
    
    const data = await GetData("Sheet1!2:6");
    const info = {
        database: data,
    }
    res.render("admin", {info});
});

// Admin Page
app.get("/admin", async (req, res) => {
    const data = await GetData("Sheet1!2:6");
    const info = {
        database: data,
    }
    res.render("admin", {info});
});

app.post("/submit", async (req, res) => {
    const id = req.params.id;
    const key = req.query.key;
    const token = req.query.token;
    const dish1 = req.query.dish1;
    const dish2 = req.query.dish2;
    const dish3 = req.query.dish3;
    let dishes = "";
    if(dish1 != undefined) dishes += dish1 + " ";
    if(dish2 != undefined) dishes += dish2 + " ";
    if(dish3 != undefined) dishes += dish3 + " ";

    const tableID = req.query.tableID;
    const rowID = parseInt(tableID) + 1;
    if(key == jwtSecretKey && token != null) {
        try {
        const decode = jwt.verify(token, key);
        console.log(decode);
        if(decode.restaurantID != 1) {
            res.send(`<h1>Access Denied</h1><h2>Wrong Restaurant</h2>`);
        } else {
            UpdateData(`Sheet1!B${rowID}:B${rowID}`, [["Ordered"]]);
            UpdateData(`Sheet1!E${rowID}:E${rowID}`, [[dishes]]);
            res.send(`<h1>Ordered</h1><h2>Thanks for ordering</h2>`)
        }
        
        }
        catch(err) {
            res.send(`<h1>Access Denied</h1><h2>Unvalid Json Web Token(${err.message})</h2>`);
        }
    } else {
        res.send(`<h1>Access Denied</h1><h2>Unvalid Json Web Token(invalid key)</h2>`);
    }
});

app.post("/order/:id", async (req, res) => {
    const id = req.params.id;
    const key = req.query.key;
    const token = req.query.token;
    const location = req.query.location;
    
    
    

    if(key == jwtSecretKey && token != null) {
        try {
        const decode = jwt.verify(token, key);
        console.log(decode);
        
        if(decode.restaurantID != 1) {
            res.send(`<h1>Access Denied</h1><h2>Wrong Restaurant</h2>`);
        } else {
            const info = {
                id: id,
                key: key,
                token: token,
                tableID: decode.tableID,
            }
            if(location != "true") {
                res.render("form", {info});
            } else {
                const tableID = decode.tableID;
                const rowID = parseInt(tableID) + 1;
                const database = await GetData(`Sheet1!C${rowID}:D${rowID}`)
                if(parseInt(database[0][0]) > parseInt(database[0][1])) {
                    console.log(database);
                    UpdateData(`Sheet1!D${rowID}:D${rowID}`, [[parseInt(database[0][1]) + 1]]);
                    res.render("order", {info});
                } else {
                    res.send(`<h1>Access Denied</h1><h2>Capacity Excess</h2>`);
                }
                
            }
        }
        
        }
        catch(err) {
            res.send(`<h1>Access Denied</h1><h2>Unvalid Json Web Token(${err.message})</h2>`);
        }
    } else {
        res.send(`<h1>Access Denied</h1><h2>Unvalid Json Web Token(invalid key)</h2>`);
    }
    
    
    
});

// Generate New URL
app.get("/generate", async (req, res) => {
    const tableID = req.query.tableID;
    const maxQuota = req.query.maxQuota;
    const rowID = parseInt(tableID) + 1;
    
    console.log(req.query);
    const url = `Table${tableID}`;

    var hashUrl = "";

    var hashSalt = await bcrypt.genSalt(saltRounds);
    var hash = await bcrypt.hash(url, hashSalt);
    hashUrl = hash.replace('/', '');
    
    let data = {
        restaurantID: 1,
        tableID: tableID,
    }

    const token = jwt.sign(data, jwtSecretKey, { expiresIn: "4h" });
    await UpdateData(`Sheet1!${rowID}:${rowID}`, [[tableID, "Ordering", maxQuota, 0, "", `${rootURL}/order/${hashUrl}?token=${token}&key=${jwtSecretKey}`]]);

    let info = {
        tableID: tableID,
        rootUrl: rootURL,
        url: `${url}`,
        hashSalt: hashSalt,
        hashUrl: `${hashUrl}`,
        key: jwtSecretKey,
        token: token,
    }

    res.render("generate", {info});
});

app.listen(5050, (req, res) => console.log("Running on 5050"));