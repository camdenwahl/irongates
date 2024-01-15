const User = require("../models/user");
const Quest = require("../models/quest");
const Skill = require("../models/skill");
const Character = require("../models/character");
const asyncHandler = require("express-async-handler");


exports.skill_page = asyncHandler(async (req, res, next) => {
    const allSkills = await Skill.find({ 
        $or: [
            { category: { $ne: 'Devil Fruit' } },
            { category: 'Devil Fruit', isAcquired: false }
        ] 
    });    
    const userID = req.user._id;
    const characters = await Character.find({owner: userID});
    const skillCategories = Skill.schema.path('category').enumValues;
    res.render("skills", {
        skill_list: allSkills,
        characters: characters,
        categories: skillCategories,
    });
});

exports.skill_info = asyncHandler(async (req, res, next) => {
    const SkillId = req.params.skillId;
    const skills = await Skill.findById(SkillId);
    const skillsList = await Skill.find({});
    const characterId = req.query.characterId;
    const prerequisiteSkills = [];

    if(!skills) {
        return res.status(404).send("Skill not found.");
    }

        // Fetch prerequisite skill information
        if (skills.prerequisites && skills.prerequisites.length > 0) {
            for (const prereq of skills.prerequisites) {
                const prereqSkill = await Skill.findById(prereq.skill);
                if (prereqSkill) {
                    prerequisiteSkills.push({
                        name: prereqSkill.skill_name,
                        proficiency: prereq.requiredProficiency
                    });
                }
            }
        }

    res.render('skillsdetail', {
        title: skills.name,
        skills: skills,
        skillsList: skillsList,
        characterId: characterId,
        prerequisiteSkills: prerequisiteSkills 
    });
});

exports.addSkillToCharacter = asyncHandler(async (req, res, next) => {
    const {characterId} = req.params;
    const {skillId} = req.body;

    const character = await Character.findById(characterId);
    await character.save();

    res.json({message: "Skill added successfuly."});
})