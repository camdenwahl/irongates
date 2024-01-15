const User = require("../models/user");
const Quest = require("../models/quest");
const Skill = require("../models/skill");
const Race = require("../models/race");
const Character = require("../models/character");
const asyncHandler = require('express-async-handler');
const {body, validationResult} = require("express-validator");
const mongoose = require("mongoose");

exports.userCharacters = asyncHandler(async (req, res, next) => {
    const UserID = req.params.UserID;
    const characters = await Character.find({owner: UserID});
    
    let query = { owner: UserID };
    if (req.user._id.toString() !== UserID) {
        // Viewer is not the owner, only show public characters
        query.isPrivate = false;
    }

    res.render('usercharacters', {
        title: "User's Characters",
        characters: characters,
    });
});

exports.character_detail = asyncHandler(async ( req, res, next) => {
    const CharacterID = req.params.CharacterID;
    const character = await Character.findById(CharacterID).populate("owner", "username").populate("skills.skill").populate("race");
    const message = req.query.message; // Get message from query string    
    if (character.isPrivate && character.owner._id.toString() !== req.user._id.toString()) {
        // Character is private and viewer is not the owner
        return res.status(403).send("You are not authorized to view this character.");
    }
    
    res.render('character_detail', {
        title: "Character Information",
        character: character,
        owner: character.owner,
        req: req,
        message: message,
    })
})

exports.character_create_get = asyncHandler(async (req, res, next) => {
    try {
        const skills = await Skill.find({ 
            $or: [
                { category: { $ne: 'Devil Fruit' } },
                { category: 'Devil Fruit', isAcquired: false }
            ] 
        }).populate({
            path: 'prerequisites.skill',
            model: 'Skill', // The model name you're referencing
            select: 'skill_name'
        });

        for (const skill of skills) {
            if (skill.prerequisites && skill.prerequisites.length > 0) {
                // Fetch each prerequisite skill name
                for (const prereq of skill.prerequisites) {
                    // console.log('Current Prereq Object:', prereq);
                    const prereqId = prereq.skill
                    const prereqSkill = await Skill.findOne({prereqId});
                    // console.log('Fetched Prerequisite Skill:', prereqSkill);
                    prereq.skillName = prereqSkill ? prereqSkill.skill_name : 'Unknown';
                }
            }
        }

        
        const races = await Race.find(); 
        // Group skills by category
        const skillsByCategory = skills.reduce((acc, skill) => {
            acc[skill.category] = acc[skill.category] || [];
            acc[skill.category].push(skill);
            return acc;
        }, {});

        const data = {
            skillsByCategory,
            skills: skills
        }

        res.render("character_form", {
            title: "Create a Character",
            races: races,
            data: data,
            errors: [] // To ensure errors is always defined
        });
    } catch (error) {
        console.error(error);
        // Error handling, possibly rendering an error page
    }
});


exports.character_create_post = [
    body("name", "Name must contain at least three characters.")
        .trim()
        .isLength({min: 3})
        .escape(),

    asyncHandler(async (req, res, next) => {
        const allSkills = await Skill.find();
        const {affiliation, gender, age} = req.body;
        const races = await Race.find(); 
        const skillMap = new Map(allSkills.map(skill => [skill._id, skill]));
        const selectedRace = await Race.findById(req.body.race).populate('forcedSkills.skill');
        if (!selectedRace) {
            return renderCharacterFormWithError(req, res, "Invalid race selected.");
        }


        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return renderCharacterFormWithError(req, res, errors.array());
        }

        const { skillIds, totalSkillCost, skillsData } = await processSkills(req.body.skills, req);
        for (const skillId of skillIds) {
            const skill = await Skill.findById(skillId);
            if (skill.category === 'Devil Fruit' && skill.isAcquired) {
                // Return an error message
                return renderCharacterFormWithError(req, res, "This Devil Fruit skill has already been acquired.");
            }
        }

        if (totalSkillCost > 10) {
            return renderCharacterFormWithError(req, res, "Not enough skill points for the selected skills.");
        }

    
        if (await hasReachedCharacterLimit(req.user._id)) {
            const skills = await Skill.find();
            const skillsByCategory = skills.reduce((acc, skill) => {
                acc[skill.category] = acc[skill.category] || [];
                acc[skill.category].push(skill);
                return acc;
            }, {});
    
            const data = {
                skillsByCategory,
                skills: skills
            }
            return res.render("character_form", {
                title: "Create a Character",
                character: req.body,
                data: data,
                races: races,
                errors: [{ msg: "You cannot create more than three characters." }],
                
            });
        }

        const characterExists = await Character.findOne({ characterID: req.body.name }).exec();
        if (characterExists) {
            return res.redirect("Character already exists.");
        }

        const prerequisiteError = await checkPrerequisites(skillIds, skillsData, skillMap);
        if (prerequisiteError) {
            return renderCharacterFormWithError(req, res, "Prerequisites not met.");
        }

        let devilFruitSkillsCount = 0;
        for (const skillId of skillIds) {
            const skill = await Skill.findById(skillId);
            if (skill && skill.category === 'Devil Fruit') {
                devilFruitSkillsCount++;
                if (devilFruitSkillsCount > 1) {
                    // Return an error message
                    return renderCharacterFormWithError(req, res, "Only one Devil Fruit skill can be selected.");
                }
            }
        }
        
        let img = {};
        if (req.file) {
            img = {
                data: req.file.buffer,
                contentType: req.file.mimetype
            };
        }
        
        

        await saveAndRedirectNewCharacter(req, res, {
            owner: req.user._id,
            image: img,
            name: req.body.name,
            affiliation: affiliation,
            gender: gender,
            age: age,
            biography: req.body.biography,
            skills: skillsData,
            race: selectedRace._id,
            skillPoints: 10 - totalSkillCost,
        });
    })
];
async function checkPrerequisites(skillIds, skillsData, skillMap) {
    for (const { skill: skillId, proficiencyLevel } of skillsData) {
        const skill = skillMap.get(skillId);
        console.log(skill)

        if (!skill) {
            console.error(`Skill not found: ${skillId}`);
            continue;
        }

        for (const prereq of skill.prerequisites) {
            console.log(prereq)
            const prereqSkill = skillMap.get(prereq.skill._id.toString());
            if (!prereqSkill) {
                continue; // Skip if prerequisite skill is not found
            }
            const selectedPrereq = skillsData.find(s => s.skill._id === prereq.skill._id.toString());
            if (!selectedPrereq || selectedPrereq.proficiencyLevel < prereq.requiredProficiency) {
                return `Prerequisite not met for skill: ${skill.skill_name}`;
            }
        }
    }
    return null; // No prerequisite errors
}


async function processSkills(skills, req) {
    let skillsData = [];
    let skillIds = [];
    let totalSkillCost = 0;

    if (skills) {
        if (!Array.isArray(skills)) {
            skills = [skills];
        }
        skillIds = skills;
        const skillsFromDb = await Skill.find({ '_id': { $in: skillIds } });

        for (const skillId of skillIds) {
            const proficiencyLevel = req.body['proficiency_' + skillId] ? parseInt(req.body['proficiency_' + skillId], 10) : 1;
            const skill = skillsFromDb.find(dbSkill => dbSkill._id.toString() === skillId);
            if (skill) {
                skillsData.push({
                    skill: skillId,
                    proficiencyLevel: proficiencyLevel
                });
                totalSkillCost += skill.skillCost * proficiencyLevel; // Calculate cost based on proficiency level
            }
        }
    }

    return { skillIds, totalSkillCost, skillsData };
}


async function hasReachedCharacterLimit(userId) {
    const characterLimit = 3;
    const existingCharacterCount = await Character.countDocuments({ owner: userId });
    return existingCharacterCount >= characterLimit;
}

async function renderCharacterFormWithError(req, res, error) {
    let errorsToShow = [];
    
    if (typeof error === 'string') {
        errorsToShow = [{ msg: error }];
    } else if (Array.isArray(error)) {
        errorsToShow = error;
    } else if (error instanceof Error) {
        errorsToShow = [{ msg: error.message }];
    }

    const skills = await Skill.find().populate('prerequisites');
    const races = await Race.find();
    const skillsByCategory = skills.reduce((acc, skill) => {
        acc[skill.category] = acc[skill.category] || [];
        acc[skill.category].push(skill);
        return acc;
    }, {});

    const data = {
        skillsByCategory,
        skills: skills
    }

    res.render("character_form", {
        title: "Create a Character",
        character: req.body,
        data: data,
        races: races,
        errors: errorsToShow
    });
}


async function saveAndRedirectNewCharacter(req, res, characterData) {
    const { skillIds, totalSkillCost, skillsData } = await processSkills(req.body.skills, req);
    for (const skillId of skillIds) {
        const skill = await Skill.findById(skillId);
        if (skill.category === 'Devil Fruit') {
            skill.isAcquired = true;
            await skill.save();
        }
    }
    const character = new Character(characterData);
    await character.save();
    res.redirect(character.url);
}


exports.character_delete_post = asyncHandler(async (req, res, next) => {
    const characterId = req.params.id;

    //Fetch characters and check ownership
    const character = await Character.findById(characterId);
    if (!character) {
        return res.status(404).send("Character not found.");
    }

    //Check if the logged in user is the owner of the character.
    if (character.owner.toString() !== req.user._id.toString()) {
        return res.status(403).send("Unauthorized to delete this character");
    }

    await Character.findByIdAndDelete(characterId);

    res.redirect('/home');
})

exports.character_skill_upgrade_post = asyncHandler(async (req, res, next) => {
    const {characterId} = req.params;
    const {skillId, newProficiency} = req.body;

    const character = await Character.findById(characterId);
    const selectedSkill = await Skill.findById(skillId);

    if (!character.owner.equals(req.user._id)) {
        return res.status(403).send("Unauthorized to upgrade skills for this character.");
    }

    const skillToUpdate = character.skills.find(skill => skill.skill.toString() === skillId);
    if (skillToUpdate) {
        if (newProficiency <= character.skillPoints){
            const calculatedProficiency = parseInt(skillToUpdate.proficiencyLevel) + parseInt(newProficiency);
            if (calculatedProficiency > selectedSkill.proficiency) {
                return res.redirect('/' + characterId + '/character_detail?message=Max skill level reached.' )
            }
            character.skillPoints = parseInt(character.skillPoints) - parseInt(newProficiency);
            skillToUpdate.proficiencyLevel = parseInt(calculatedProficiency);
            await character.save();
        }

    }
    res.redirect('/' + characterId +'/character_detail');
})

exports.addSkill = asyncHandler(async (req, res, next) => {
    console.log(req.params)
    const {characterId, skillId} = req.params;
    const {proficiencyLevel} = req.body;
    const allSkills = await Skill.find();
    const character = await Character.findById(characterId).populate('skills.skill');
    const skillToAdd = await Skill.findById(skillId).populate('prerequisites');
    if(!character || !skillToAdd) {
        return res.status(404).send("Character or skill not found.");
    }


        // Check if the character already has a 'Devil Fruit' skill
        const hasDevilFruitSkill = character.skills.some(skillObj => {
            const skill = allSkills.find(s => s._id.equals(skillObj.skill._id));
            return skill && skill.category === 'Devil Fruit';
        });
        
        if (hasDevilFruitSkill && skillToAdd.category === 'Devil Fruit') {
            return res.status(400).send('Character already has a Devil Fruit skill');
        }



    // Check if the character already has the skill
    if (character.skills.some(skillObj => skillObj.skill._id.equals(skillId))) {
        return res.status(400).send('Character already has this skill');
    }

        // Check if proficiency level is valid
        if (proficiencyLevel < 1 || proficiencyLevel > skillToAdd.proficiency) {
            return res.status(400).send('Invalid proficiency level');
        }
    

    // Check if the character can afford the skill
    if (character.skillPoints < skillToAdd.skillCost * proficiencyLevel) {
        return res.status(400).send('Not enough skill points');
    }

    
    // Check if the skill to add is a 'Devil Fruit' skill
    if (skillToAdd.category === 'Devil Fruit') {
        // Refetch the skill to ensure it's the latest state
        const freshSkillToAdd = await Skill.findById(skillId);

        // Check if the skill is already acquired
        if (freshSkillToAdd.isAcquired) {
            return res.status(400).send('This Devil Fruit skill has already been acquired by another character.');
        }

        // Mark the skill as acquired
        freshSkillToAdd.isAcquired = true;
        await freshSkillToAdd.save();
    }

    // Check prerequisites
    for (const prerequisite of skillToAdd.prerequisites) {
        const prereqSkill = await Skill.findById(prerequisite.skill);

        if (!character.skills.some(skillObj => skillObj.skill._id.equals(prerequisite.skill))) {
            const prerequisiteName = prereqSkill ? prereqSkill.skill_name : 'Unknown';
            return res.status(400).send(`Missing prerequisite: ${prerequisiteName}`);
        }
    }

    character.skills.push({ skill: skillToAdd._id, proficiencyLevel });
    character.skillPoints -= skillToAdd.skillCost * proficiencyLevel;
    await character.save();

    // Redirect or send a response
    res.redirect(`/${characterId}/character_detail`);
});


exports.updateCharacterStatus = asyncHandler(async (req, res, next) => {
    const { characterId } = req.params;
    const { newStatus } = req.body;

    // Ensure the user is an admin
    if (!req.user.isAdmin) {
        return res.status(403).send('Access denied');
    }

    // Update the character status
    await Character.findByIdAndUpdate(characterId, { characterStatus: newStatus });

    // Redirect back to the manage characters page or show a success message
    res.redirect('/admin/character-status');
});


exports.manageCharacters = asyncHandler(async (req, res, next) => {
    // Ensure the user is an admin

    // Fetch all characters, including the owner's username
    // Make sure to populate the necessary fields
    const characters = await Character.find().populate('owner', 'username').populate('skills.skill');

    // Render the manage characters view with the characters data
    res.render('admin-manage-characters', {
        title: 'Manage Characters',
        characters: characters
    });
});

exports.toggleCharacterPrivacy = asyncHandler(async (req, res, next) => {
    const characterId = req.params.characterId;

    const character = await Character.findById(characterId);
    if (!character || character.owner.toString() !== req.user._id.toString()) {
        return res.status(404).send("Character not found or not owned by user.");
    }

    character.isPrivate = !character.isPrivate;
    await character.save();

    res.redirect('/home'); // Redirect back to the main layout or relevant page
});
