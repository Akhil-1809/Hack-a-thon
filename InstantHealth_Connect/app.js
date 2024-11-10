

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
const methodOverride = require('method-override');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookie = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const upload = require('express-fileupload');
const docxConverter = require('docx-pdf');
const patient = require('./models/patient');
const doctor = require('./models/doctor');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const app = express();
const { v4: uuidV4 } = require('uuid'); 
const http = require('http').createServer(app);
const io = require('socket.io')(http);


app.use(express.static('public'));
app.get('/create-session', (req, res) => {
  const sessionId = '1a5787fc-1f5e-4cf2-a428-26d500339858'; 
  res.send({ sessionId });
});


mongoose.connect("mongodb+srv://chaitanyaakhil123:z0oiWJFgCYv60I4g@cluster0.5bpzu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0y",{ useNewUrlParser: true , useUnifiedTopology: true, useCreateIndex : true, useFindAndModify : false})

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});



app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, '/public')));
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(cookie());
app.use(session({
    cookie: { maxAge: 60000 },
    secret: 'woot',
    resave: false,
    saveUninitialized: false
}));
app.use(flash());
app.use(upload());

const CLIENT_ID = 'your_client_id';
const CLEINT_SECRET = 'your_client_secret';
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';
const REFRESH_TOKEN = 'your_refresh_token';

const oAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLEINT_SECRET,
    REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const JWT_SECRET = "mysecretKey";

// ==================================================== VERIFY Function =========================================================================
async function verify(req, res, next) {
    console.log(req.cookies);
    const token = await req.cookies.token;
    if (!token) {
        req.auth = "Not allowed";
        next();
    }
    else {
        try {
            const decode = await jwt.verify(token, "mysecretKEY", { algorithm: 'HS256' })
            req.dataa = decode;
            req.auth = "allowed"
            next();
        }
        catch (e) {
            console.log(e.message);
            req.auth = "Not allowed";
            next();
        }

    }
}

// ==================================================== Home =========================================================================

app.get('/', (req, res) => {
    console.log("GET: /HomePage");
    res.render('homePage');
});


// ==================================================== Patient Dashboard =========================================================================

app.get('/patientDashboard', verify, (req, res) => {
    console.log("GET: /patientDashboard");
    patientID = req.dataa.id;
    console.log(patientID);
    res.render('patientDashboard');
});

// ==================================================== Current Advice =========================================================================

app.get('/currentAdvice', verify, (req, res) => {
    console.log("GET: /currentAdvice");
    patientID = req.dataa.id;
    console.log(patientID);
    patient.findById(patientID, async (err, foundPatient) => {
        if (err) {
            console.log("Error in finding the patient in /currentAdvice");
            console.log(err);
        } else {
            console.log(foundPatient);
            var x = foundPatient.remarksByDoctors;

            res.render("currentAdvice", { foundPatient: foundPatient, x });
        }
    });
});

// ==================================================== New Advice =========================================================================

app.get('/newAdvice', verify, (req, res) => {
    console.log("GET: /newAdvice");
    patientID = req.dataa.id;
    console.log(patientID);
    res.render("newAdvice");
});

app.post('/newAdvice', verify, async (req, res) => {
    console.log("POST: /newAdvice");

    patientID = req.dataa.id;
    console.log("Patient ID:", patientID);
    var diseaseType = req.body.diseaseType;
    var severity = req.body.severity;
    console.log("Disease Type: ", diseaseType);
    console.log("Severity: ", severity);
    patient.findByIdAndUpdate(patientID, { safe: true, upsert: true }, async (err, foundPatient) => {
        if (err) {
            console.log("Error in finding patient in :/newAdvice");
            console.log(err);
        } else {
            console.log("FoundPatient");
            console.log(foundPatient);
            console.log(foundPatient.currentAdvice);
            if (foundPatient.currentAdvice == 1) {
                res.render('currentAdvice', { variable: "You have a Current Advice running already.You can only register for a new advice if the current advice is resolved.", foundPatient: foundPatient });
            } else {
                foundPatient.diseaseType = diseaseType;
                foundPatient.severity = severity;
                foundPatient.currentAdvice = 1;
                try {
                    if (req.files) {
                        var file = req.files.uploadFile;
                        console.log(file);
                        uploadFile = file.name;
                        uploadExtension = file.name.split(".")[1];
                        if (uploadExtension == "pdf") {
                            file.mv("./patientReportUpload/" + foundPatient.phoneNumber + "." + uploadExtension, (err) => {
                                if (err) {
                                    console.log("Error in uploadExtension PDF");
                                    console.log(err);
                                } else {
                                    console.log("Successfully uploaded");
                                    foundPatient.save();
                                    console.log("Patient Details in New Advice");
                                    console.log(foundPatient);
                                    res.redirect("/beforeDoctorsListPage");
                                }
                            })
                        } else {
                            file.mv("./otherFormatPatientReportUpload/" + foundPatient.phoneNumber + "." + uploadExtension, (err) => {
                                if (err) {
                                    console.log("Error in uploadExtension Other format");
                                    console.log(err);
                                } else {
                                    docxConverter("./otherFormatPatientReportUpload/" + foundPatient.phoneNumber + "." + uploadExtension, "./patientReportUpload/" + foundPatient.phoneNumber + ".pdf", (err, result) => {
                                        if (err) {
                                            console.log("Error in docx to pdf converter");
                                            console.log(err);
                                        } else {
                                            console.log(result);
                                        }
                                    });
                                    console.log("Successfully uploaded");
                                    foundPatient.save();
                                    console.log("Patient Details in New Advice");
                                    console.log(foundPatient);
                                    res.redirect('/beforeDoctorsListPage');
                                }
                            })
                        }
                    }
                } catch (e) {
                    console.log("Error in reports uploads");
                    console.log(e);
                }
            }
        }
    });
});

// ==================================================== Before Doctors List Page =========================================================================

app.get('/beforeDoctorsListPage', verify, async (req, res) => {
    console.log("GET: /beforeDoctorsListPage");

    doctorsList = [];

    const patientID = req.dataa.id;
    try {
        patient.findById(patientID, async (err, foundPatient) => {
            const doctors = await doctor.find();
            console.log(typeof (doctors));
            doctors.forEach(doctorFound => {
                doctorSpecialization = doctorFound.specialization.split(" ")[0];
                doctorLanguage = doctorFound.language;
                patientNeededSpecialization = foundPatient.diseaseType.split(" ")[0];
                patientLanguage = foundPatient.language;
                if (doctorSpecialization.toUpperCase() === patientNeededSpecialization.toUpperCase() && doctorLanguage.toUpperCase() === patientLanguage.toUpperCase()) {
                    doctorsList.push(doctorFound);
                    console.log("Same");
                } else {
                    console.log("Not Same");
                }
            });
            console.log("DoctorsList");
            console.log(doctorsList);
            res.render("beforeDoctorsListPage", { doctorsList: doctorsList, variable: " " });
        });
    } catch (e) {
        console.log("Error in /beforeDoctorsListPage");
        console.log(e);
    }
});

app.post('/beforeDoctorsListPage', verify, async (req, res) => {
    console.log("POST: /beforeDoctorsListPage");

    patientID = req.dataa.id;
    console.log("Patient ID:", patientID);
    console.log(typeof (patientID));
    var x = req.body.selectName;
    if (typeof (x) == String) {
        patient.findByIdAndUpdate(patientID, { doctorsSelected: x }, async (err, foundPatient) => {
            if (err) {
                console.log("Error in find and update");
                console.log(err);
            } else {
                try {
                    console.log("X");
                    console.log(x);
                    console.log(typeof(foundPatient.doctorsSelected));
                    doctor.findOne({ _id: foundPatient.doctorsSelected }, (err, foundDoctor) => {
                        if (err) {
                            console.log("Error in finding doctor in POST before Doctor List Page");
                            console.log(err);
                        } else {
                            console.log("Doctor Found");
                            console.log(foundDoctor);
                        }
                    });
                    console.log("Successful");
                    await foundPatient.save();
                    res.redirect('/patientDashboard');
                } catch (e) {
                    console.log("Error in try catch");
                    console.log(e);
                }
            }
        });
    } else if (typeof (x) == Array && x.length > 3) {
        try {
            patient.findById(patientID, async (err, foundPatient) => {
                const doctors = await doctor.find();
                console.log(typeof (doctors));
                doctors.forEach(doctorFound => {
                    doctorSpecialization = doctorFound.specialization.split(" ")[0];
                    doctorLanguage = doctorFound.language;
                    patientNeededSpecialization = foundPatient.diseaseType.split(" ")[0];
                    patientLanguage = foundPatient.language;
                    if (doctorSpecialization.toUpperCase() === patientNeededSpecialization.toUpperCase() && doctorLanguage.toUpperCase() === patientLanguage.toUpperCase()) {
                        doctorsList.push(doctorFound);
                        console.log("Same");
                    } else {
                        console.log("Not Same");
                    }
                });
                console.log("DoctorsList");
                console.log(doctorsList);
                res.render("beforeDoctorsListPage", { doctorsList: doctorsList, variable: "You have selected more than 3 doctors, you can select only 3 doctors" });
            });
        } catch (e) {
            console.log("Error in catch");
            console.log()
        }
    } else {
        patient.findByIdAndUpdate(patientID, { doctorsSelected: x }, (err, foundPatient) => {
            if (err) {
                console.log("Error in find and update");
                console.log(err);
            } else {
                console.log("Successful");
            }
        });
        console.log("X");
        console.log(x);
        res.redirect('/patientDashboard');
    }
});

// ==================================================== Doctors List Page =========================================================================

app.get('/doctorsListPage', verify, async (req, res) => {
    console.log("GET: /doctorsListPage");

    doctorsList = [];

    const patientID = req.dataa.id;
    try {
        patient.findById(patientID, async (err, foundPatient) => {
            const doctors = await doctor.find();
            console.log(typeof (doctors));
            doctors.forEach(doctorFound => {
                console.log("Doctor Found ");
                console.log(doctorFound);
                console.log(typeof (doctorFound));
                doctorSpecialization = doctorFound.specialization.split(" ")[0];
                patientNeededSpecialization = foundPatient.diseaseType.split(" ")[0];
                if (doctorSpecialization.toUpperCase() === patientNeededSpecialization.toUpperCase()) {
                    doctorsList.push(doctorFound);
                    console.log("Same");
                } else {
                    console.log("Not Same");
                }
            });
            console.log("DoctorsList");
            console.log(doctorsList);
            res.render("doctorsListPage", { doctorsList: doctorsList, variable: " " });
        });
    } catch (e) {
        console.log("Error in /doctorsListPage");
        console.log(e);
    }
});

app.post('/doctorsListPage', verify, (req, res) => {
    console.log("POST: /doctorsListPage");

    patientID = req.dataa.id;
    console.log("Patient ID:", patientID);
    var x = req.body.selectName;
    if (typeof (x) == String) {
        patient.findByIdAndUpdate(patientID, { doctorsSelected: x }, (err, foundPatient) => {
            if (err) {
                console.log("Error in find and update");
                console.log(err);
            } else {
                console.log("Successful");
            }
        });
        foundPatient.save();
        res.redirect('/patientDashboard');
    } else if (typeof (x) == Array && x.length > 3) {
        try {
            patient.findById(patientID, async (err, foundPatient) => {
                const doctors = await doctor.find();
                console.log(typeof (doctors));
                doctors.forEach(doctorFound => {
                    console.log("Doctor Found ");
                    console.log(doctorFound);
                    console.log(typeof (doctorFound));
                    doctorSpecialization = doctorFound.specialization.split(" ")[0];
                    patientNeededSpecialization = foundPatient.diseaseType.split(" ")[0];
                    if (doctorSpecialization.toUpperCase() === patientNeededSpecialization.toUpperCase()) {
                        doctorsList.push(doctorFound);
                        console.log("Same");
                    } else {
                        console.log("Not Same");
                    }
                });
                console.log("DoctorsList");
                console.log(doctorsList);
                res.render("doctorsListPage", { doctorsList: doctorsList, variable: "You have selected more than 3 doctors, you can select only 3 doctors" });
            });
        } catch (e) {
            console.log("Error in catch");
            console.log()
        }
    } else {
        patient.findByIdAndUpdate(patientID, { doctorsSelected: x }, (err, foundPatient) => {
            if (err) {
                console.log("Error in find and update");
                console.log(err);
            } else {
                console.log("Successful");
            }
        });
        console.log(x);
        res.redirect('/patientDashboard');
    }
});

// ==================================================== Doctor Dashboard =========================================================================

app.get('/doctorDashboard', verify, (req, res) => {
    console.log("GET: /doctorDashboard");
    doctorID = req.dataa.id;
    console.log(doctorID);
    res.render('doctorDashboard', { variable: " " });
});

// ==================================================== Doctor Old Patient =========================================================================

app.get('/doctorOldPatient', verify, async (req, res) => {
    console.log("GET :/doctorOldPatient");
    const patients = await patient.find();
    var oldPatients = [];
    console.log(typeof (patients));
    patients.forEach(foundPatient => {
        if (foundPatient.visitedOnce == 1) {
            oldPatients.push(foundPatient);
        }
    });
    console.log(oldPatients);
    if (oldPatients.length == 0) {
        console.log("No old patients");
        res.render("doctorDashboard", { variable: "You don't have any old Patients" });
    } else {
        res.render('doctorOldPatient', { oldPatients: oldPatients });
    }
});

// ==================================================== Doctor New Patient =========================================================================

app.get('/doctorNewPatient', verify, async (req, res) => {
    console.log("GET :/doctorNewPatient");
    const patients = await patient.find();
    var newPatients = [];
    patients.forEach(foundPatient => {
        if (foundPatient.visited == 0) {
            console.log("New Patient");
            newPatients.push(foundPatient);
            foundPatient.visited = 1;
            foundPatient.visitedOnce = 1;
            foundPatient.save();
        }
    });
    if (newPatients.length == 0) {
        console.log("No new patients");
        res.render("doctorDashboard", { variable: "You don't have any new Patients" });
    } else {
        res.render('doctorNewPatient', { newPatients: newPatients });
    }
});

// ==================================================== Doctor Patient Info =========================================================================

app.get('/doctorPatientInfo/:id', verify, async (req, res) => {
    console.log("GET :/doctorPatientInfo/:id");
    console.log(req.params);
    patientID = req.params.id;
    console.log("Patient ID:", patientID);
    doctorID = req.dataa.id;
    console.log("Doctor ID:", doctorID);
    const foundPatient = await patient.findById(patientID);
    res.render('doctorPatientInfo', { foundPatient: foundPatient });
});

// ==================================================== Doctor Patient Info Old =========================================================================

app.get('/doctorPatientInfoOld/:id', verify, async (req, res) => {

    console.log("GET :/doctorPatientInfoOld/:id");

    patientID = req.params.id;
    console.log("Patient ID:", patientID);
    doctorID2 = req.dataa.id;
    console.log("Doctor ID:", doctorID2);
    const foundPatient = await patient.findById(patientID);
    var x = '';
    var flag = 0;
    foundPatient.remarksByDoctors.forEach(doctorDetails => {
        if (doctorDetails.doctorID == doctorID2) {
            x = doctorDetails.remarks;
            flag = 1;
            //break;
        } else {
            flag = 0;
            //continue;
        }
    });
    console.log("Remarks: ", x);
    res.render('doctorPatientInfoOld', { foundPatient: foundPatient, x: x });
});

// ==================================================== Download =========================================================================

app.get('/download/:id', async (req, res) => {
    console.log("GET :/download/:id");
    const sid = req.params.id;
    const foundPatient = await patient.findById(sid);
    const phoneNumber = foundPatient.phoneNumber;
    const file = `${__dirname}/patientReportUpload/${phoneNumber}.pdf`;
    res.download(file); // Set disposition and send it.
});

// ==================================================== Doctor Checked Patients =========================================================================

app.post('/doctorCheckedPatients/:id', verify, async (req, res) => {
    console.log("POST: /doctorCheckPatients/:id");
    var patientID = req.params.id;
    var doctorID = req.dataa.id;
    const remarks = req.body.remarks;

    const foundDoctor = await doctor.findOne({ _id: doctorID });

    patient.findOne({ _id: patientID }, async (err, foundPatient) => {
        if (err) {
            console.log("Error in finding and updating in doctorCheckedPatients");
            console.log(err);
        } else {
            var x = foundPatient.remarksByDoctors;
            var y = { doctorID: doctorID, doctorName: foundDoctor.name, remarks: remarks };
            x.push(y);
            await patient.updateOne({ _id: patientID }, { $set: { "remarksByDoctors": x, "visited": 0, "currentAdvice": 0 } });

            async function sendMail() {
                try {
                    const accessToken = await oAuth2Client.getAccessToken();

                    const transport = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            type: 'OAuth2',
                            user: 'designthinkingteam4@gmail.com',
                            clientId: CLIENT_ID,
                            clientSecret: CLEINT_SECRET,
                            refreshToken: REFRESH_TOKEN,
                            accessToken: accessToken,
                        },
                    });

                    const mailOptions = {
                        from: 'SECOND OPINION <designthinkingteam4@gmail.com>',
                        to: foundPatient.email,
                        subject: 'SECOND OPINION:',
                        text: 'Here is the link to reset your password',
                        html: '<h1>Hello from SECOND OPINION</h1> <br> <h2>Dr.' + foundDoctor.name + ' has given his opinion on your request.</h2>',
                    };

                    const result = await transport.sendMail(mailOptions);
                    return result;
                } catch (error) {
                    return error;
                }
            }

            sendMail()
                .then((result) => console.log('Email sent...', result))
                .catch((error) => console.log(error.message));

            res.redirect('/doctorDashboard');
        }
    });

    /*     patient.findByIdAndUpdate(patientID, {remarks: remarks, visited: 0, currentAdvice: 0}, (err, foundPatient) => {
            if(err){
                console.log("Error in finding and updating in doctorCheckedPatients");
                console.log(err);
            } else {
                foundPatient.remarksByDoctor.push({doctorID:doctorID, doctorName: doctorName, });
                console.log("Updated Successfully");
                res.redirect('/doctorDashboard');
            }
        }); */
});
// =============================================================================================================================================
// ====================================================== AUTHENTICATION =======================================================================
// =============================================================================================================================================

// ===================================================== PATIENT REGISTER =====================================================================

app.get('/patientSignUpPage', (req, res) => {
    console.log("GET: /patientSignUpPage");
    res.render("patientSignUpPage");
});

app.post("/patientSignUpPage", async (req, res) => {
    console.log("POST: /patientSignUpPage");

    var newPatient = new patient({
        name: req.body.name,
        phoneNumber: req.body.phoneNumber,
        email: req.body.email,
        region: req.body.region,
        language: req.body.language,
        doctorsSelected: [],
        remarksByDoctors: [],
        password: '',
        remarks: '',
        visited: 0,
        visitedOnce: 0,
        currentAdvice: 0
    });
    if (req.body.password != req.body.confirmPassword) {
        req.flash("error", "Password mismatch");
        res.redirect("/patientSignUpPage");
    } else if (req.body.password.length < 8) {
        req.flash("error", "Password should have minimum 8 characters");
        res.redirect("/patientSignUpPage");
    } else {
        try {
            const salt = await bcrypt.genSalt(10);
            let password = await bcrypt.hash(req.body.password, salt);
            newPatient.password = password;
            await newPatient.save();
            console.log("Patient Details:");
            console.log(newPatient);
            res.redirect("/patientLogin");
        }
        catch (e) {
            console.log("Error in patientSignUpPage");
            console.log(e);
        }
    }
});




//

app.get('/emer', (req, res) => {
    console.log("GET: /emer");
    res.render("emer");
});


//

// ===================================================== PATIENT LOGIN =====================================================================

app.get('/patientLogin', (req, res) => {
    console.log('GET: /patientLogin');
    res.render('patientLogin');
});

app.post('/patientLogin', async (req, res) => {
    console.log("POST: /patientLogin");
    try {
        const { phoneNumber, password } = req.body;
        const pat = await patient.findOne({ phoneNumber });
        if (!pat) {
            res.json({ message: "Invalid Creds" });
        }
        const value = await bcrypt.compare(password, pat.password);
        const payload = {
            id: pat._id
        }
        if (value) {
            const token = await jwt.sign(payload, "mysecretKEY", { algorithm: 'HS256' });
            res.cookie("token", token, { httpOnly: true });
            res.redirect("/patientDashboard");
        } else {
            res.json({ message: "Invalid Creds" });
        }
    } catch (e) {
        console.log("Error in patientLogin");
        console.log(e);
    }
});

app.get('/forgotPasswordPatient', (req, res) => {
    console.log("GET: /forgotPasswordPatient");
    res.render('forgotPasswordPatient');
});

app.post('/forgotPasswordPatient', async (req, res) => {
    console.log("POST: /forgotPasswordPatient");

    const { email } = req.body;

    var foundPatient = await patient.findOne({ email: email });

    if (email != foundPatient.email) {
        console.log("User not registered");
        res.render('forgotPasswordPatient', { variable: "User is not registered" });
    }

    const secret = JWT_SECRET + foundPatient.password;
    const payload = {
        email: foundPatient.email,
        id: foundPatient._id
    }

    const token = jwt.sign(payload, secret, { expiresIn: '15m' });
    const link = `http://localhost:3000/resetPasswordPatient/${foundPatient._id}/${token}`;

    async function sendMail() {
        try {
            const accessToken = await oAuth2Client.getAccessToken();

            const transport = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    type: 'OAuth2',
                    user: 'designthinkingteam4@gmail.com',
                    clientId: CLIENT_ID,
                    clientSecret: CLEINT_SECRET,
                    refreshToken: REFRESH_TOKEN,
                    accessToken: accessToken,
                },
            });

            const mailOptions = {
                from: 'SECOND OPINION <designthinkingteam4@gmail.com>',
                to: foundPatient.email,
                subject: 'SECOND OPINION: Link to Reset Password',
                text: 'Here is the link to reset your password',
                html: '<h1>Hello from SECOND OPINION</h1> <br> <h2>Link to reset password: ' + link + "</h2>",
            };

            const result = await transport.sendMail(mailOptions);
            return result;
        } catch (error) {
            return error;
        }
    }

    sendMail()
        .then((result) => console.log('Email sent...', result))
        .catch((error) => console.log(error.message));

    console.log(link);
    res.send("Password reset link has been sent successfully .If you dont find the message in inbox. Please check SPAM");
});

app.get('/resetPasswordPatient/:id/:token', async (req, res) => {
    console.log("GET: /resetPasswordPatient");

    const { id, token } = req.params;

    var foundPatient = await patient.findById(id);

    const secret = JWT_SECRET + foundPatient.password;
    try {
        const payload = jwt.verify(token, secret);
        res.render('resetPasswordPatient', { name: foundPatient.name, variable: "" });
    } catch (e) {
        console.log("Error in catch of reset Password");
        console.log(e);
    }
});

app.post('/resetPasswordPatient/:id/:token', async (req, res) => {
    console.log("POST: /resetPasswordPatient");

    const { id, token } = req.params;

    var foundPatient = await patient.findById(id);

    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        console.log("Password mismatch in reset password patient");
        res.render('resetPasswordPatient', { name: foundPatient.name, variable: "Password mismatch" })
    }
    const secret = JWT_SECRET + foundPatient.password;
    try {
        const payload = jwt.verify(token, secret);
        const salt = await bcrypt.genSalt(10);
        let password = await bcrypt.hash(req.body.password, salt);
        foundPatient.password = password;
        await foundPatient.save();
        res.redirect('/patientLogin');
    } catch (e) {
        console.log("Error in catch of reset Password post");
        console.log(e);
    }
});

// ===================================================== DOCTOR REGISTER =====================================================================

app.get('/doctorSignUp', (req, res) => {
    console.log("GET: /doctorSignUp");
    res.render("doctorSignUp");
})

app.post('/doctorSignUp', async (req, res) => {
    console.log("POST: /doctorSignUp");

    var newDoctor = new doctor({
        name: req.body.name,
        email: req.body.email,
        phoneNumber: req.body.phoneNumber,
        region: req.body.region,
        language: req.body.language,
        specialization: req.body.specialization,
        password: ''

    });
    if (req.body.password != req.body.confirmPassword) {
        req.flash("error", "Password mismatch");
        res.render("doctorSignUp", { variable: "Error, please try again" });
    } else if (req.body.password.length < 8) {
        req.flash("error", "Password should have minimum 8 characters");
        res.render("doctorSignUp", { variable: "Error, please try again" });
    } else {
        try {
            const salt = await bcrypt.genSalt(10);
            let password = await bcrypt.hash(req.body.password, salt);
            newDoctor.password = password;
            await newDoctor.save();
            console.log("Doctor Details:");
            console.log(newDoctor);
            res.redirect("/doctorCertificateUploadPage/" + newDoctor._id);
        }
        catch (e) {
            console.log("Error in doctorSignUp");
            console.log(e);
        }
    }
});

app.get("/doctorCertificateUploadPage/:id", verify, (req, res) => {
    console.log("GET: /doctorCertificateUploadPage/:id");

    var doctorID = req.params.id;

    console.log("Doctor ID:", doctorID);

    doctor.findById(doctorID, (err, foundDoctor) => {
        if (err) {
            console.log("Error in doctorertificateUploadPage");
            console.log(err);
        } else {
            res.render("doctorCertificateUploadPage", { foundDoctor: foundDoctor });
        }
    });
});

app.post("/doctorCertificateUploadPage/:id", verify, (req, res) => {
    console.log("POST: /doctorCertificateUploadPage/:id");

    var doctorID = req.params.id;

    doctor.findByIdAndUpdate(doctorID,
        { safe: true, upsert: true },
        (err, foundDoctor) => {
            if (err) {
                console.log("Error in POST of doctorCertificateUploadPage");
                console.log(err);
            } else {
                try {
                    if (req.files) {
                        var file = req.files.uploadFile;
                        console.log(file);
                        uploadFile = file.name;
                        uploadExtension = file.name.split(".")[1];
                        if (uploadExtension == "pdf") {
                            file.mv("./pdfCertificateUpload/" + foundDoctor.phoneNumber + "." + uploadExtension, (err) => {
                                if (err) {
                                    console.log("Error in uploadExtension PDF");
                                    console.log(err);
                                } else {
                                    console.log("Successfully uploaded");
                                    res.redirect("/doctorLogin");
                                }
                            })
                        } else {
                            file.mv("./otherFormatCertificateUpload/" + foundDoctor.phoneNumber + "." + uploadExtension, (err) => {
                                if (err) {
                                    console.log("Error in uploadExtension Other format");
                                    console.log(err);
                                } else {
                                    docxConverter("./otherFormatCertificateUpload/" + foundDoctor.phoneNumber + "." + uploadExtension, "./pdfCertificateUpload/" + foundDoctor.phoneNumber + ".pdf", (err, result) => {
                                        if (err) {
                                            console.log("Error in docx to pdf converter");
                                            console.log(err);
                                        } else {
                                            console.log(result);
                                        }
                                    });
                                    console.log("Successfully uploaded");
                                    res.redirect('/doctorLogin');
                                }
                            })
                        }
                    }
                } catch (e) {
                    console.log("Error in certificate uploads");
                    console.log(e);
                }
            }
        });
});

// ===================================================== DOCTOR LOGIN =====================================================================
app.get('/doctorLogin', (req, res) => {
    console.log("GET: /doctorLogin");
    res.render("doctorLogin");
})

app.post("/doctorLogin", async (req, res) => {
    console.log("POST: /doctorLogin");
    try {
        const { phoneNumber, password } = req.body;
        const doc = await doctor.findOne({ phoneNumber });
        if (!doc) {
            res.json({ message: "Invalid Creds" });
        }
        const value = await bcrypt.compare(password, doc.password);
        const payload = {
            id: doc._id
        }
        if (value) {
            const token = await jwt.sign(payload, "mysecretKEY", { algorithm: 'HS256' });
            res.cookie("token", token, { httpOnly: true });
            res.redirect("/doctorDashboard");
        } else {
            res.json({ message: "Invalid Creds" });
        }
    } catch (e) {
        console.log("Error in doctorLogin");
        console.log(e);
    }
});

app.get('/forgotPasswordDoctor', (req, res) => {
    console.log("GET: /forgotPasswordDoctor");
    res.render('forgotPasswordDoctor');
});

app.post('/forgotPasswordDoctor', async (req, res) => {
    console.log("POST: /forgotPasswordDoctor");

    const { email } = req.body;

    var foundDoctor = await doctor.findOne({ email: email });

    if (email != foundDoctor.email) {
        console.log("User not registered");
        res.render('forgotPasswordDoctor', { variable: "User is not registered" });
    }

    const secret = JWT_SECRET + foundDoctor.password;
    const payload = {
        email: foundDoctor.email,
        id: foundDoctor._id
    }

    const token = jwt.sign(payload, secret, { expiresIn: '15m' });
    const link = `http://localhost:3000/resetPasswordDoctor/${foundDoctor._id}/${token}`;

    async function sendMail() {
        try {
            const accessToken = await oAuth2Client.getAccessToken();

            const transport = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    type: 'OAuth2',
                    user: 'designthinkingteam4@gmail.com',
                    clientId: CLIENT_ID,
                    clientSecret: CLEINT_SECRET,
                    refreshToken: REFRESH_TOKEN,
                    accessToken: accessToken,
                },
            });

            const mailOptions = {
                from: 'SECONDOPINION <designthinkingteam4@gmail.com>',
                to: foundDoctor.email,
                subject: 'SECOND OPINION: Link to Reset Password',
                text: 'Here is the link to reset your password: ' + link,
                html: '<h1>Hello from SECOND OPINION</h1> <br> <h2>Link to reset password: ' + link + "</h2>",
            };

            const result = await transport.sendMail(mailOptions);
            return result;
        } catch (error) {
            return error;
        }
    }

    sendMail()
        .then((result) => console.log('Email sent...', result))
        .catch((error) => console.log(error.message));

    res.send("Password reset link has been sent successfully .If you dont find the message in inbox. Please check SPAM");
});

app.get('/resetPasswordDoctor/:id/:token', async (req, res) => {
    console.log("GET: /resetPasswordDoctor");

    const { id, token } = req.params;

    var foundDoctor = await doctor.findById(id);

    const secret = JWT_SECRET + foundDoctor.password;
    try {
        const payload = jwt.verify(token, secret);
        res.render('resetPasswordDoctor', { name: foundDoctor.name, variable: "" });
    } catch (e) {
        console.log("Error in catch of reset Password");
        console.log(e);
    }
});

app.post('/resetPasswordDoctor/:id/:token', async (req, res) => {
    console.log("POST: /resetPasswordDoctor");

    const { id, token } = req.params;

    var foundDoctor = await doctor.findById(id);

    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        console.log("Password mismatch in reset password patient");
        res.render('resetPasswordDoctor', { name: foundDoctor.name, variable: "Password mismatch" })
    }
    const secret = JWT_SECRET + foundDoctor.password;
    try {
        const payload = jwt.verify(token, secret);
        const salt = await bcrypt.genSalt(10);
        let password = await bcrypt.hash(req.body.password, salt);
        foundDoctor.password = password;
        await foundDoctor.save();
        res.redirect('/doctorLogin');
    } catch (e) {
        console.log("Error in catch of reset Password post");
        console.log(e);
    }
});

//============================================================ LOGOUT ===========================================================================
app.get("/logout", function (req, res) {
    res.clearCookie("token");
    res.redirect("/");
});



// Socket.io connection setup
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
  
    socket.on('join-session', (sessionId, userId) => {
      socket.join(sessionId);
      console.log(`User ${userId} joined session ${sessionId}`);
      socket.broadcast.to(sessionId).emit('user-connected', userId);
  
      socket.on('disconnect', () => {
        console.log(`User ${userId} disconnected from session ${sessionId}`);
        socket.broadcast.to(sessionId).emit('user-disconnected', userId);
      });
    });
  
    socket.on('offer', (userId, description) => {
      socket.to(userId).emit('offer', socket.id, description);
    });
  
    socket.on('answer', (userId, description) => {
      socket.to(userId).emit('answer', description);
    });
  
    socket.on('candidate', (userId, candidate) => {
      socket.to(userId).emit('candidate', socket.id, candidate);
    });
  });


http.listen(3000, () => {
    console.log("Server working on PORT 3000!!!");
})
