/*
*   User class
*   Storage class for user data.
*   Also manage connection between local, Discord and EvE.
*/

"use strict";



// <============== Static requirements
var Q      = require("q");
var url    = require("url");
var crypto = require("crypto");
var db     = require("json-db-lite");
var Error  = require(__dirname+"/utils/error.class.js");
var API    = require(__dirname+"/API/crestApi.class.js");
var config = require(__dirname+"/utils/config.single.js");


/*
*   User constructor
*/
var User = function() {
    this.data = {
        // OAuth data exchanged with EvE SSO
        oauth: null,
        // EvE ID and name of the character
        eveId: null,
        eveName: null,
        // Discord ID of the user
        discordId: null,
        // Verification code used during registration
        verifCode: null
    };
};

/*
*   loadDiscordId()
*   Load user based on discord ID
*/
User.prototype.loadDiscordId = function(id) {
    if(typeof id == "undefined") throw new Error("Invalid Discord ID");
    // Set ID
    this.data.discordId = id;
    // Load from database if it exists
    var data = db.get("users."+this.data.discordId);
    if(data !== null) this.data = data;
    return this;
};

/*
*   save()
*   Save user data in database.
*   Return a promise.
*/
User.prototype.save = function() {
    db.set("users."+this.data.discordId, this.data);
    return db.save();
};

/*
*   isAuthenticated()
*   Return weither the user was previously authenticated with EvE SSO or not.
*   Return a boolean.
*/
User.prototype.isAuthenticated = function() {
    return this.data.eveId !== null;
};

/*
*   getAllFits()
*   Return character fittings in JSON format.
*   Return a promise.
*/
User.prototype.getAllFits = function() {
    return (new API()).getCharFits(this.data.oauth, this.data.eveId);
};

/*
*   getRegisterLink()
*   Return a link for user authentication (the user needs to visit the link at
*   least once for establishing connection between Discord and EvE IDs).
*   "verifCode" is used to ensure that someone else cannot build the link and register
*   under a Discord ID he/she does not own.
*   Return the URL as string.
*/
User.prototype.getRegisterLink = function() {
    // Generate and save verifCode using strong random generator
    this.data.verifCode = crypto.randomBytes(32).toString("hex");
    this.save();
    // Return URL
    return url.format({
        protocol: config.get("local_protocol"),
        host:     config.get("local_hostname"),
        pathname: "/register/",
        query: {
            discordId: this.data.discordId,
            verifCode: this.data.verifCode
        }
    });
};

/*
*   checkRegisterLink()
*   Check if the code provided is correct.
*   Return a promise.
*/
User.prototype.checkRegisterLink = function(code) {
    if(this.data.verifCode == code) {
        // If correct, delete the code (one-time usage)
        this.data.verifCode = null;
        return Q();
    } else {
        // If incorrect, throw an error.
        return Q.reject(new Error("invalid code", "Verification code is invalid.", 403));
    }
};

/*
*   initEvE()
*   Initialise account by requesting and saving character ID and name from CREST.
*   Also save OAuth data for future usage.
*   Return a promise.
*/
User.prototype.initEvE = function(oauth) {
    var self = this;
    // Save OAuth data
    if(typeof oauth == "undefined") throw new Error("Invalid OAuth data");
    self.data.oauth = oauth;
    // Request character data
    return (new API()).getCharacterData(oauth.access_token).then(function(data) {
        // Load user and save data
        self.data.eveId = data.CharacterID;
        self.data.eveName = data.CharacterName;
        return self.save();
    });
};



module.exports = User;