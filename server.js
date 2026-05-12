const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Use memory storage for now (data will reset on restart)
// We'll fix SQLite later
let appointments = [];
let nextId = 1;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.post('/api/appointments', (req, res) => {
    const { firstName, lastName, phone, email, appointmentDate, appointmentTime, serviceType, symptoms } = req.body;
    
    const appointment = {
        id: nextId++,
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        service_type: serviceType,
        symptoms,
        status: 'pending',
        created_at: new Date().toISOString()
    };
    
    appointments.push(appointment);
    res.json({ success: true, data: { id: appointment.id } });
});

app.get('/api/appointments', (req, res) => {
    let result = [...appointments];
    
    if (req.query.date) {
        result = result.filter(a => a.appointment_date === req.query.date);
    }
    if (req.query.status) {
        result = result.filter(a => a.status === req.query.status);
    }
    
    res.json({ success: true, count: result.length, data: result });
});

app.get('/api/stats', (req, res) => {
    res.json({ 
        success: true, 
        data: { 
            total: appointments.length,
            today: appointments.filter(a => a.appointment_date === new Date().toISOString().split('T')[0]).length,
            pending: appointments.filter(a => a.status === 'pending').length,
            confirmed: appointments.filter(a => a.status === 'confirmed').length,
            completed: appointments.filter(a => a.status === 'completed').length,
            thisMonth: appointments.filter(a => a.appointment_date.startsWith(new Date().toISOString().slice(0, 7))).length
        } 
    });
});

app.patch('/api/appointments/:id/status', (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    const appointment = appointments.find(a => a.id === id);
    if (!appointment) {
        return res.status(404).json({ success: false, error: 'Not found' });
    }
    
    appointment.status = status;
    res.json({ success: true, message: `Status updated to ${status}` });
});

app.delete('/api/appointments/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = appointments.findIndex(a => a.id === id);
    
    if (index === -1) {
        return res.status(404).json({ success: false, error: 'Not found' });
    }
    
    appointments.splice(index, 1);
    res.json({ success: true, message: 'Deleted successfully' });
});

app.get('/api/search', (req, res) => {
    const { query } = req.query;
    if (!query) return res.status(400).json({ success: false, error: 'Search query required' });
    
    const searchTerm = query.toLowerCase();
    const result = appointments.filter(a => 
        a.first_name.toLowerCase().includes(searchTerm) ||
        a.last_name.toLowerCase().includes(searchTerm) ||
        a.phone.includes(searchTerm) ||
        (a.email && a.email.toLowerCase().includes(searchTerm))
    );
    
    res.json({ success: true, count: result.length, data: result });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});