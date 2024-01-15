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
const race_controller = require("../controllers/raceController");
const User = require("../models/user");

function isAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.isAdmin) {
        return next();
    }
    else {
        res.redirect('/')
    }
}

router.get('/', isAdmin, (req, res, next) => {
    if(req.user.isAdmin === true) {
        res.render("admin-dashboard");
    } else {
        res.redirect('/users');
    }
});

router.get('/users', isAdmin, user_controller.admin_user_list);

router.get('/users/edit/:UserID', isAdmin, user_controller.admin_user_edit);

router.post('/users/edit/:UserID', isAdmin, user_controller.admin_user_update);

router.get('/create-skill', isAdmin, user_controller.admin_get_create_skill);

router.post('/create-skill', isAdmin, user_controller.admin_post_create_skill);

router.get('/character-status', isAdmin, character_controller.manageCharacters);

router.post('/characters/:characterId/updateStatus', isAdmin, character_controller.updateCharacterStatus);

router.get('/quest-status', isAdmin, quest_controller.manage_quests_get);

router.post('/quests/:questId/updateStatus', isAdmin, quest_controller.update_quest_status_post);

router.get('/manage-races', isAdmin, race_controller.manageRaces_get);

router.post('/race/create', race_controller.manageRaces_post);

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
