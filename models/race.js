const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const RaceSchema = new Schema({
    name: {type: String, required: true},
    forcedSkills: [{
        skill: {type: Schema.Types.ObjectId, ref: "Skill"},
        proficiencyLevel: {type: Number, required: true}
    }]
});

module.exports = mongoose.model("Race", RaceSchema);