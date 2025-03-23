const rootURL = "127.0.0.1:5050";

let jwtSecretKey = "Th1sis$ecr3t";
const spreadsheetId = ""; /* Enter your Sheet ID HERE */
const saltRounds = 10; /* 10-12 for best results */

const keyFilePosition = "credentials.json";
const bcrypt = require('bcrypt');
const express = require("express");
const {google} = require("googleapis");
const dotenv = require('dotenv');
const geolib = require('geolib');
const axios = require('axios');
const cookieParser = require('cookie-parser');

 

dotenv.config();

const jwt = require('jsonwebtoken');

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const restaurantLocation = {
    latitude: 22.432792,
    longitude: 114.241867,
    geofenceRadius: 100,

}

/* Functions */

// Get Google Sheet(Database) Information
async function InitGoogleSheet() {
    const auth = new google.auth.GoogleAuth({
        keyFile: keyFilePosition,
        scopes: "https://www.googleapis.com/auth/spreadsheets",
    });

    const client = await auth.getClient();

    const googleSheets = google.sheets({version: "v4", auth: client});
    return {auth, googleSheets};
}

/* Read data form Database */
async function GetData(dataRange) { // dataRange e.g. "Sheet1!A:A"
    const {auth, googleSheets} = await InitGoogleSheet();

    const metaData = await googleSheets.spreadsheets.get({ // For Debug Usage
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

//
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

async function ValidateLocation(latitude, longitude) {
    try {
        // Basic coordinate validation
        if (!latitude || !longitude || 
            latitude < -90 || latitude > 90 || 
            longitude < -180 || longitude > 180) {
            return {
                isValid: false,
                message: 'Invalid coordinates provided'
            };
        }
       
        const distance = geolib.getDistance(
            { latitude, longitude },
            { 
                latitude: restaurantLocation.latitude, 
                longitude: restaurantLocation.longitude 
            }
        );

        const ALLOWED_RADIUS = restaurantLocation.geofenceRadius || 100; // meters
        
        const valid = parseFloat(distance) <= parseFloat(ALLOWED_RADIUS);
        console.log("dis>>", distance, ALLOWED_RADIUS, valid);
        return {
            isValid: valid,
            message: valid 
                ? 'Location verified'
                : 'You must be inside the restaurant to place an order'
        };
    } catch (error) {
        throw new Error(`Location validation failed: ${error.message}`);
    }
}

function SetCookie(cname, cvalie, expiredMin, res) {
    let options = {
        maxAge: 1000 * 60 * expiredMin, // Expire In `expiredMin` minutes
    }
    res.cookie(cname, cvalie, options)
}

function DeniedAccessWithMessage(message, res) {
    res.send(`<h1>Access Denied</h1><h2>${message}</h2>`);
}

function TryDecodeToken(token, res) {
    try {
        const decode = jwt.verify(token, jwtSecretKey);
        return decode;
    } catch(err) {
        console.log(err);
        let message = "";
        if(err.message == "jwt expired") {
            message = "Validity Expired.";
        } else if (err.message == "jwt must be provided") {
            message = "Token is Empty.";
        } else if (err.message == "invalid signature") {
            message = "Invalid Token.";
        }
        DeniedAccessWithMessage(message, res);
        return null;
    }
}

/* Get Views */

app.get("/", (req, res) => {
    res.render("index");
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

app.get("/submit", async (req, res) => {
    const cookie = req.cookies;
    const token = cookie.token;

    const dish1 = req.query.dish1;
    const dish2 = req.query.dish2;
    const dish3 = req.query.dish3;
    let dishes = "";
    if(dish1 != undefined) dishes += dish1 + " ";
    if(dish2 != undefined) dishes += dish2 + " ";
    if(dish3 != undefined) dishes += dish3 + " ";

    const tableID = req.query.tableID;
    const rowID = parseInt(tableID) + 1;

    const decode = TryDecodeToken(token, res);
    if(decode != null) {
        UpdateData(`Sheet1!B${rowID}:B${rowID}`, [["Ordered"]]);
        UpdateData(`Sheet1!E${rowID}:E${rowID}`, [[dishes]]);
        res.send(`<h1>Ordered</h1><h2>Thanks for ordering</h2>`)
    }
});

app.get("/form", async (req, res) => { 
    const cookie = req.cookies;
    console.log(cookie);
    const token = cookie.token;

    const decode = TryDecodeToken(token, res);
    
    if(decode != null) {
        res.render("form");
    }
})


app.get("/auth", async (req, res) => { 
    const token = req.query.token;
    SetCookie('token', token, 15, res);
    return res.redirect(`/form`);
})

app.post("/menu/:id", async (req, res) => {
    
    const id = req.params.id;

    const cookie = req.cookies;
    const token = cookie.token;
    const decode = TryDecodeToken(token, res);
    if(decode != null) {
        const decode = jwt.verify(token, jwtSecretKey);
        const tableID = decode.tableID;
        const rowID = parseInt(tableID) + 1;

        const database = await GetData(`Sheet1!F${rowID}:F${rowID}`);
        
        console.log(database);

        if(database != undefined && database[0][0] == id) {
            const info = {
                tableID: decode.tableID,
            }
            res.render("menu", {info});
        } else {
            DeniedAccessWithMessage("Disabled URL.", res)
        }

        
    }
}); 



app.post("/order", async (req, res) => {

    const cookie = req.cookies;
    const token = cookie.token;

    const location = req.body.location;
    const curLatitude = req.body.latitude;
    const curLongitude = req.body.longitude;

    const decode = TryDecodeToken(token, res);
    if(decode != null) {
        if(location != "true") {
            DeniedAccessWithMessage("Sorry. We need to collect your geographic location to ensure the safety of the ordering process.", res);
        } else {
            const locationCheck = ValidateLocation(curLatitude, curLongitude);
            const valid = (await locationCheck).isValid;

            if(valid) {
                const tableID = decode.tableID;
                const rowID = parseInt(tableID) + 1;
                const database = await GetData(`Sheet1!C${rowID}:F${rowID}`)
                if(parseInt(database[0][0]) > parseInt(database[0][1])) { // Check Quota
                    
                        UpdateData(`Sheet1!D${rowID}:D${rowID}`, [[parseInt(database[0][1]) + 1]]);
                        const url = database[0][3];
    
                        const info = {
                            tableID: decode.tableID,
                        }
                        return res.redirect(307, `/menu/${url}`);

                } else {
                    DeniedAccessWithMessage("Quota Exceed", res);
                }
            } else {
                DeniedAccessWithMessage("Wrong Location", res);
            }
            
        }
    }
    
    
    
});

// Generate New URL
app.get("/generate", async (req, res) => {
    const tableID = req.query.tableID;
    const maxQuota = req.query.maxQuota;
    const rowID = parseInt(tableID) + 1;
    
    const url = `Table${tableID}`;

    var hashUrl = "";

    var hashSalt = await bcrypt.genSalt(saltRounds);
    var hash = await bcrypt.hash(url, hashSalt);
    hashUrl = hash.replace('/', '_');
    
    let data = {
        restaurantID: 1,
        tableID: tableID,
        time: Date.now(),
    }

    const token = jwt.sign(data, jwtSecretKey, { expiresIn: "1h" });
    await UpdateData(`Sheet1!${rowID}:${rowID}`, [[tableID, "Ordering", maxQuota, 0, "", `${hashUrl}`]]);

    let info = {
        tableID: tableID,
        rootUrl: rootURL,
        url: url,
        hashSalt: hashSalt,
        hashUrl: hashUrl,
        token: token,
    }

    res.render("generate", {info});
});

app.listen(5050, (req, res) => console.log("Running on 5050"));