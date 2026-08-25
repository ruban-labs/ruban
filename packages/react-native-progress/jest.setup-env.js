// Some outer shells export NODE_ENV=production; Jest tests need the
// React development build (React 19 strips `act` from production builds).
process.env.NODE_ENV = 'test';
