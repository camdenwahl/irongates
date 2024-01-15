const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CharacterSchema = new Schema({
    owner: {type: Schema.Types.ObjectId, required: true, ref: "User"},
    image: {data: Buffer, contentType: String},
    gender: {type: String},
    age: {type: Number},
    affiliation: {type: String, required: true,  enum: ["Pirate", "Independent", "Marine", "Revolutionary", "Bounty Hunter"]},
    name: {type: String, required: true, maxLength: 50},
    biography: {type: String, required: true},
    race: {type: Schema.Types.ObjectId, ref: "Race"},
    skillPoints: {type: Number, default: 10},
    skills: [
        {skill: {type: Schema.Types.ObjectId, ref: "Skill"},
    proficiencyLevel: {type: Number, default: 0}},
    ],
    isPrivate: { type: Boolean, default: false },
    characterStatus: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
});


CharacterSchema.pre('save', function(next) {
    if (this.isNew && this.characterStatus === 'Pending') {
        this.isPrivate = true;
    }
    next();
});
CharacterSchema.virtual("url").get(function() {
    return `/${this._id}/character_detail`;
});

module.exports = mongoose.model("Character", CharacterSchema);