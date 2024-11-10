const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DoctorSchema = new Schema({
    name: String,
    phoneNumber: String,
    email: String,
    specialization: String,
    region: String,
    remarks: String,
    language: String,
    password: String,
    confirmPassword: String,
    fileUpload: {
        data: Buffer,
        contentType: String
    }
})

module.exports = mongoose.model('Doctor', DoctorSchema);