const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    username: {type: String, required: true, maxLength: 30, unique: true},
    email: {type: String, required: true, maxLength: 100, unique: true , match: [/.+\@.+\..+/, 'Please fill a valid email address'] },
    password: {type: String, required: true, maxLength: 100},
    isAdmin: {type: Boolean, default: false},
    passwordResetToken: {type: String},
    passwordResetExpires: {type: Date},
});

UserSchema.virtual("url").get(function () {
    return `/${this._id}`;
});

module.exports = mongoose.model("User", UserSchema);