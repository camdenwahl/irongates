const mongoose = require("mongoose");
const Schema = mongoose.Schema;

QuestSchema = new Schema({
    quest_name: {type: String, required: true},
    description: {type: String, required: true},
    requirements: [String],
    rewards: [String],
    adminConfirmation: { type: Boolean, default: false },
    skillPointsReward: { type: Number, default: 0 },
    pointsDistributed: { type: Boolean, default: false },
    status: {type: String, required: true, enum: ["Pending", "In Progress", "Completed", "Abandoned"], default: "Pending"},
    signUpRequests: [{ type: Schema.Types.ObjectId, ref: "Character", default: [] }],
    participants: [{type: Schema.Types.ObjectId, ref: "Character" }],
    creator: {type: Schema.Types.ObjectId, ref: "User", required: true},
});

QuestSchema.virtual("url").get(function (){
    return `/quests/${this._id}/questdetail`;
});

module.exports = mongoose.model("Quest", QuestSchema);