const jwt = require('jsonwebtoken');
const SECRET = 'vespoint_secret_key';

function signToken(user) {
    return jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET, { expiresIn: '1d' });
}

function verifyToken(token) {
    return jwt.verify(token, SECRET);
}

module.exports = { signToken, verifyToken };