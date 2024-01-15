const User = require("../models/user");
const Quest = require("../models/quest");
const Skill = require("../models/skill");
const Character = require("../models/character");
const Race = require("../models/race");
const asyncHandler = require("express-async-handler");
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose')



let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASS
    }
  });



exports.main_layout = asyncHandler(async(req, res, next) => {
    const userID = req.params.UserID;
    const characters = await Character.find({owner: req.user}).populate('skills.skill').populate('race');

    characters.forEach(character => {
        if (character.image && character.image.data) {
            character.imageBase64 = `data:${character.image.contentType};base64,${character.image.data.toString('base64')}`;
        }

        character.isOwner = character.owner.toString() === req.user._id.toString();
    });

    res.render("index", {
        title: "One Piece: Legacies",
        user: req.user,
        characters: characters
        
        });

});

exports.user_list = asyncHandler(async(req, res, next) => {
    const allUsers = await User.find({}, "username")
    .sort({username: 1});

    res.render("users", {
        title: "One Piece: Legacies",
        user_list: allUsers,
        });


});

exports.admin_user_list = asyncHandler(async(req, res, next) => {
    const allUsers = await User.find({})
    .sort({username: 1});

    res.render("admin-users", {
        title: "One Piece: Legacies",
        users: allUsers,
        });


});

exports.admin_user_edit = asyncHandler(async(req, res, next) => {
    const userID = req.params.UserID;
    const user = await User.findById(userID);
    res.render("edit_user", {
        title: "One Piece: Legacies",
        user: user,
        });


});

exports.admin_user_update = asyncHandler(async (req, res, next) => {
    const userID = req.params.UserID;
    const updatedData = {
        username: req.body.username,
        email: req.body.email,
        // Add other fields as necessary
    };

    await User.findByIdAndUpdate(userID, updatedData);

    res.redirect('/admin/users');
})

exports.admin_get_create_skill = asyncHandler(async (req, res, next) => {
    const skillCategories = Skill.schema.path('category').enumValues;
    const allSkills = await Skill.find().select('skill_name _id').exec();
    res.render('admin-create-skill', {
        title: "Create New Skill",
        categories: skillCategories,
        allSkills: allSkills
    })
});

exports.admin_post_create_skill = asyncHandler(async (req, res, next) => {
    
    const minLevels = Array.isArray(req.body['minLevel[]']) ? req.body['minLevel[]'] : [req.body['minLevel[]']];
    const maxLevels = Array.isArray(req.body['maxLevel[]']) ? req.body['maxLevel[]'] : [req.body['maxLevel[]']];
    const descriptions = Array.isArray(req.body['levelDescriptions[]']) ? req.body['levelDescriptions[]'] : [req.body['levelDescriptions[]']];

    // Map through the arrays to construct proficiency descriptions
    const proficiencyLevels = minLevels.map((min, index) => ({
        levelRange: {
            min: parseInt(min, 10),
            max: parseInt(maxLevels[index], 10)
        },
        description: descriptions[index]
    }));
    const { prerequisites} = req.body;
    let processedPrerequisites = [];

    if (prerequisites) {
        const prerequisiteIds = Array.isArray(prerequisites) ? prerequisites : [prerequisites];
        prerequisiteIds.forEach(prerequisiteId => {
            const requiredProficiency = req.body[`requiredProficiency[${prerequisiteId}]`];
            processedPrerequisites.push({
                skill: new mongoose.Types.ObjectId(prerequisiteId), // Convert to ObjectId
                requiredProficiency: requiredProficiency ? Number(requiredProficiency) : 1
            });
        });
    }
    


    
    console.log(req.body);

    const newSkill = new Skill({
        skill_name: req.body.skill_name,
        description: req.body.description,
        proficiency: req.body.defaultProficiency,
        category: req.body.category,
        skillCost: req.body.skillCost,
        prerequisites: processedPrerequisites,
        defaultProficiency: req.body.defaultProficiency,
        proficiencyDescriptions: proficiencyLevels
    });
    await newSkill.save();
    res.redirect('/admin');
})

exports.post_forgot_password = asyncHandler(async (req, res, next) => {
    const { email } = req.body;
    const user = await User.findOne({ email: email });

    if (!user) {
        // Optionally, redirect or show an error message
        return res.redirect('/log-in');
    }

    const token = crypto.randomBytes(20).toString('hex');
    user.passwordResetToken = token;
    user.passwordResetExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    let mailOptions = {
        from: process.env.EMAIL_USERNAME,
        to: user.email,
        subject: 'Password Reset Link',
        text: `Please click on the following link, or paste this into your browser to complete the process: http://${req.headers.host}/reset/${token}`
    };

    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log(error);
            // Handle error
        } else {
            console.log('Email sent: ' + info.response);
            res.redirect('/log-in');
        }
    });
});


exports.get_forgot_password = asyncHandler(async (req, res, next) => {
    res.render('forgot-password'); // Render a view where users enter their email
});




// controllers/userController.js
exports.get_reset_password = asyncHandler(async (req, res, next) => {
    const { token } = req.params;
    const user = await User.findOne({ passwordResetToken: token, passwordResetExpires: { $gt: Date.now() } });
    if (!user) {
        // Handle invalid or expired token
        // Optionally, redirect or show an error message
    } else {
        res.render('reset-password', { token: token }); // Render a view where users can reset their password
    }
});



exports.post_reset_password = asyncHandler(async (req, res, next) => {
    const token = req.params.token; // Get the token from URL parameter
    const newPassword = req.body.newPassword;

    // Find the user with the provided token and check if the token has not expired
    const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: Date.now() }
    });

    console.log(token);

    // Check if user exists
    if (!user) {
        // Handle the case where no user is found or token is expired
        // You might want to redirect to an error page or show a message
        return res.status(400).send('Invalid or expired token');
    }

    // Hash new password and save
    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Redirect to login or other appropriate action
    res.redirect('/log-in');
});

exports.landing_page_get = asyncHandler(async (req, res, next) => {
    res.render('landing-page', {
        title: "One Piece: Iron Gates"
    })
})

exports.forced_skill = asyncHandler(async (req, res, next) => {
    const race = await Race.findById(req.params.id).populate('forcedSkills.skill');
    res.json(race.forcedSkills);

})