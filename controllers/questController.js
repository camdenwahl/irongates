const User = require("../models/user");
const Quest = require("../models/quest");
const Skill = require("../models/skill");
const Character = require("../models/character");
asyncHandler = require('express-async-handler');

exports.quest_list = asyncHandler(async(req, res, next) => {
    const allQuests = await Quest.find({}, "quest_name");
    res.render("quests", {
        quest_list: allQuests,
    })

})

exports.questDetail = asyncHandler(async (req, res, next) => {
    const questId = req.params.questId;
    const quest = await Quest.findById(questId).populate('signUpRequests').populate('participants').exec();
    
    // Fetch the characters of the user
    const userCharacters = await Character.find({ owner: req.user._id });

    // Now render the page with both quest and userCharacters data
    res.render('questdetail', {
        quests: quest,
        user_characters: userCharacters,
        user: req.user
        
    });
});


exports.quest_create_get = asyncHandler(async (req, res, next) => {
    const characters = await Character.find(); // Fetch all characters from the database
    res.render('quest_form', {
        title: "Create Quest",
        characters: characters
    })
})

exports.quest_create_post = asyncHandler(async(req, res, next) => {
    const characters = await Character.find(); // Fetch all characters from the database
    const {quest_name, description, requirements, numReward,  rewards, participants} = req.body;
    const creatorID = req.user._id;
    console.log(numReward);
    const pendingQuestCount = await Quest.countDocuments({
        creator: creatorID,
        status: "Pending"
    });

    if (pendingQuestCount >= 2) {
        return res.render("quest_form", {
            title: "Create Quest", 
            characters: characters,
            message: "You cannot create more quests as you already have two pending quests."
        });
    }

    const quest = new Quest({
        quest_name,
        description,
        requirements: requirements.split(',').map(item => item.trim()),
        rewards: rewards.split(',').map(item => item.trim()),
        signUpRequests: [],
        skillPointsReward: numReward,
        participants: participants ? participants : [],
        creator: creatorID
    });

    await quest.save();
    res.redirect(quest.url);
})

exports.quest_signup = asyncHandler(async (req, res, next) => {
    const questId = req.params.questId;
    const characterId = req.body.characterId;
    const userCharacters = await Character.find({ owner: req.user._id });
    const quest = await Quest.findById(questId).populate('signUpRequests').populate('participants').exec();
    let errorMessage = null;
    if (!quest) {
        errorMessage = 'Quest not found'; 
    } else if (quest.status !== 'Pending' && quest.status !== 'In Progress') {
        errorMessage = 'Quest is not open for sign-ups';
    } else if (quest.signUpRequests.map(id => id.toString()).includes(characterId) ||
        quest.participants.map(id => id.toString()).includes(characterId)) {
        errorMessage = 'Character has already signed up or is a participant';
}


    if (errorMessage) {
        // Render the quest detail page again with the error message
        return res.render('questdetail', {
            quests: quest,
            user_characters: userCharacters,
            errorMessage: errorMessage
        });
    }

    // Add the character to the sign-up requests and save
    quest.signUpRequests.push(characterId);
    await quest.save();

    // Redirect or render the page again with a success message
    res.redirect(`/quests/${questId}/questdetail`);
})

exports.quest_status =  asyncHandler(async (req, res) => {
    const { questId } = req.params;
    const { newStatus } = req.body;

    const quest = await Quest.findById(questId);
    if (req.user._id.toString() !== quest.creator.toString()) {
        // Handle unauthorized access
        return res.redirect('/quests/:questId/signup');
    }

    quest.status = newStatus;
    await quest.save();
    res.redirect(`/quests/${questId}/questdetail`);
});

exports.acceptParticipant = asyncHandler(async (req, res, next) => {
    const { questId, requestId } = req.params;

    const quest = await Quest.findById(questId);
    if (!quest) {
        return res.status(404).send('Quest not found');
    }

    // Check if the user is the quest creator
    if (req.user._id.toString() !== quest.creator.toString()) {
        return res.status(403).send('Unauthorized');
    }

    // Check if the request ID is in the sign-up requests
    if (!quest.signUpRequests.includes(requestId)) {
        return res.status(400).send('Sign-up request not found');
    }

        // Check if the character is already a participant
        if (quest.participants.some(p => p._id.equals(requestId))) {
            return res.redirect(`/quests/${questId}/questdetail?errorMessage=Character already a participant`);
        }

    // Move the character from signUpRequests to participants
    quest.signUpRequests = quest.signUpRequests.filter(id => id.toString() !== requestId);
    quest.participants.push(requestId);

    await quest.save();
    res.redirect(`/quests/${questId}/questdetail`);
});


exports.rejectParticipant = asyncHandler(async (req, res, next) => {
    const { questId, requestId } = req.params;

    const quest = await Quest.findById(questId);
    if (!quest) {
        return res.status(404).send('Quest not found');
    }

    // Check if the user is the quest creator
    if (req.user._id.toString() !== quest.creator.toString()) {
        return res.status(403).send('Unauthorized');
    }

    // Remove the character from signUpRequests
    quest.signUpRequests = quest.signUpRequests.filter(id => id.toString() !== requestId);

    await quest.save();
    res.redirect(`/quests/${questId}/questdetail`);
});

exports.adminConfirm = asyncHandler(async (req, res, next) => {
    const { questId } = req.params;
    const quest = await Quest.findById(questId);

    if (!quest) {
        return res.status(404).send('Quest not found');
    }

    // Check if the user is an admin
    if (!req.user.isAdmin) {
        return res.status(403).send('Unauthorized: Only admins can confirm quests');
    }

    // Check if the quest is already confirmed
    if (quest.adminConfirmation) {
        return res.status(400).send('Quest already confirmed');
    }

    if (quest.pointsDistributed) {
        return res.status(400).send('Skill points have already been distributed for this quest.');
    }

    // Confirm the quest
    quest.adminConfirmation = true;

    // Only distribute skill points if they have not been distributed before
    if (!quest.pointsDistributed) {
        const skillPointsReward = quest.skillPointsReward;
        for (const participantId of quest.participants) {
            await Character.findByIdAndUpdate(participantId, {
                $inc: { skillPoints: skillPointsReward }
            });
        }

        // Mark points as distributed
        quest.pointsDistributed = true;
    }

    await quest.save();
    res.redirect(`/quests/${questId}/questdetail`);
});

exports.manage_quests_get = asyncHandler(async (req, res, next) => {
    const quests = await Quest.find().populate('creator');
    res.render('admin-manage-quests', {
        quests: quests,
        message: req.flash('info')
    })
})

exports.update_quest_status_post = asyncHandler(async (req, res, next) => {
    const {questId} = req.params;
    const {newStatus} = req.body;

    await Quest.findByIdAndUpdate(questId, {status: newStatus});

    req.flash('info', 'Quest status updated successfully');
    res.redirect('/admin/quest-status');
})