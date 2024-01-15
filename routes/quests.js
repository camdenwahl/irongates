var express = require('express');
var router = express.Router();
router.use(ensureAuthenticated);
const passport = require('passport');
const bcrypt = require('bcryptjs');

//Controllers
const user_controller = require("../controllers/userController");
const quest_controller = require("../controllers/questController");
const skill_controller = require("../controllers/skillController");
const character_controller = require("../controllers/characterController");
const User = require("../models/user");


router.get("/create-quest", quest_controller.quest_create_get);

router.post("/create-quest", quest_controller.quest_create_post);

router.get('/:questId/questdetail', quest_controller.questDetail);

router.post('/:questId/signup', quest_controller.quest_signup);

router.post('/:questId/updateStatus', quest_controller.quest_status);

// For accepting a participant
router.get('/:questId/accept/:requestId', quest_controller.acceptParticipant);

// For rejecting a participant
router.get('/:questId/reject/:requestId', quest_controller.rejectParticipant);

router.post('/:questId/adminConfirm', quest_controller.adminConfirm);

module.exports = router;

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }

    const publicPaths = [
        '/log-in', 
        '/sign-up', 
        '/', 
        '/forgot-password', 
        '/forgot-password-post'
    ];
    const dynamicPaths = ['/reset/']; // Paths that might have dynamic segments

    const isPublicPath = publicPaths.includes(req.path) || 
                         dynamicPaths.some(path => req.path.startsWith(path));

    if (isPublicPath) {
        return next();
    }

    res.redirect('/log-in');
}
