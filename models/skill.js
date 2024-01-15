const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SkillSchema = new Schema({
    skill_name: {type: String, required: true},
    description: {type: String, required: true},
    proficiencyDescriptions: [{
        levelRange: {min: Number, max: Number},
        description: String,
    }],
    isAcquired: { type: Boolean, default: false },
    proficiency: {type: Number, required: true, min: 0, max: 20 },
    skillCost: {type: Number, required: true},
    category: {type: String, required: true,  enum: ["Devil Fruit", "Profession", "Intrinsic", "Extrinsic"]},
    prerequisites: [{
        skill: {type: Schema.Types.ObjectId, ref: "Skill"},
        requiredProficiency: { type: Number, min: 0, max: 20, default: 1 }}],
});

SkillSchema.virtual("url").get(function() {
    return `/skills/${this._id}`;
});

module.exports = mongoose.model("Skill", SkillSchema);