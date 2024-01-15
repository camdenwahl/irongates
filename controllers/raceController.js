const User = require("../models/user");
const Quest = require("../models/quest");
const Skill = require("../models/skill");
const Character = require("../models/character");
const Race = require("../models/race");
asyncHandler = require('express-async-handler');

exports.manageRaces_get = asyncHandler(async (req, res) => {
    const skills = await Skill.find();
    res.render('admin-create-race', {
         skills: skills,
         title: 'Manage Races' 
        });
});

// POST request handler for creating a new race
exports.manageRaces_post = asyncHandler(async (req, res) => {
    const { name, forcedSkills } = req.body;

    // Constructing forced skills array
    let forcedSkillsArray = [];
    let skillsArray = Array.isArray(forcedSkills) ? forcedSkills : [forcedSkills];
    
    if (skillsArray) {
        for (const skillId of skillsArray) {
            const proficiencyLevel = req.body['proficiency_' + skillId];
            if (proficiencyLevel) {
                forcedSkillsArray.push({
                    skill: skillId,
                    proficiencyLevel: parseInt(proficiencyLevel, 10)
                });
            }
        }
    }

    // Create and save the new race
    const newRace = new Race({
        name: name,
        forcedSkills: forcedSkillsArray
    });

    await newRace.save();

    // Redirect to the race management page or display a success message
    res.redirect('/admin/manage-races');
});



