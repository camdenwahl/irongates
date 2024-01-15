var express = require('express');
var router = express.Router();
router.use(ensureAuthenticated);
const passport = require('passport');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const emailValidator = require('email-validator');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
//Controllers
const user_controller = require("../controllers/userController");
const quest_controller = require("../controllers/questController");
const skill_controller = require("../controllers/skillController");
const character_controller = require("../controllers/characterController");
const User = require("../models/user");
const character = require('../models/character');

router.get('/home', user_controller.main_layout);

router.get("/sign-up", (req, res) => res.render("sign-up-form", {
    errorMessage: null,
}));

router.post("/sign-up", async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        
        if (!emailValidator.validate(email)) {
            return res.render("sign-up-form", {errorMessage: "Invalid email format."});
        }

        if (existingUser) {
            // Pass an error message to the sign-up page instead of sending a status 400
            return res.render("sign-up-form", { errorMessage: "Username or email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, username, password: hashedPassword });
        await user.save();
        res.redirect("/log-in");
    } catch (err) {
        return next(err);
    }
});


router.post('/log-in', passport.authenticate("local", 
{
    successRedirect: "/home",
    failureRedirect: "/log-in"
}));

router.get("/log-in", (req, res) => {
    res.render("log-in", {user: req.user});
});

router.get("/log-out", (req, res, next) => {
    req.logout((err) => {
        if(err) {
            return next(err);
        }
        res.redirect("/log-in");
    });
});

router.get('/userlist', user_controller.user_list);

router.get('/questlist', quest_controller.quest_list);

router.get('/skill-list', skill_controller.skill_page);

router.get('/:UserID/characters', character_controller.userCharacters);

router.get('/skills/:skillId', skill_controller.skill_info);

router.get("/character_form", character_controller.character_create_get);

router.post("/character_form", upload.single('characterImage'), character_controller.character_create_post);

router.post("/character/:id/delete", character_controller.character_delete_post);

router.get("/:CharacterID/character_detail", character_controller.character_detail);

router.post("/:characterId/upgrade-skill", character_controller.character_skill_upgrade_post);

router.post('/character/:characterId/addSkill/:skillId', character_controller.addSkill);

router.post('/togglePrivacy/:characterId', character_controller.toggleCharacterPrivacy);

// routes/users.js or a similar file
router.post('/forgot-password-post', user_controller.post_forgot_password);
router.get('/forgot-password', user_controller.get_forgot_password);


router.get('/reset/:token', user_controller.get_reset_password);
router.post('/reset/:token', user_controller.post_reset_password);

router.get('/', user_controller.landing_page_get);

router.get('/api/races/:id/forcedSkills', user_controller.forced_skill);

  

module.exports = router;



function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        console.log(req.isAuthenticated());
        return next();
    }

    const publicPaths = [
        '/log-in', 
        '/sign-up', 
        '/', 
        '/forgot-password', 
        '/forgot-password-post'
    ];
    const dynamicPaths = ['/reset/', '/character/']; // Paths that might have dynamic segments
    

    const isPublicPath = publicPaths.includes(req.path) || 
                         dynamicPaths.some(path => req.path.startsWith(path));

    if (isPublicPath) {
        return next();
    }

    res.redirect('/log-in');
}


