const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PatientSchema = new Schema({
    name: String,
    phoneNumber: String,
    email: String,
    diseaseType: String,
    severity: String,
    region: String,
    remarks: String,
    language: String,
    password: String,
    confirmPassword: String,
    currentAdvice: Number,
    doctorsSelected: Array,
    remarksByDoctors: Array,
    visited: Number,
    visitedOnce: Number,
    fileUpload: {
        data: Buffer,
        contentType: String
    }
});

module.exports = mongoose.model('Patient', PatientSchema);