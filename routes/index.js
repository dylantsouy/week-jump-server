const { Router } = require('express');
const router = Router();
const TargetControllers = require('../controllers/target');
const TrackingtControllers = require('../controllers/tracking');
const AdminControllers = require('../controllers/admin');
const StockControllers = require('../controllers/stock');
const JumpControllers = require('../controllers/jump');
const NewstControllers = require('../controllers/news');
const verifyToken = require('../middlewares/authJwt');

router
    .post('/signin', AdminControllers.signin)
    .post('/signup', AdminControllers.signup)
    .get('/admins', [verifyToken], AdminControllers.getAllAdmins)
    .put('/admins/:id', [verifyToken], AdminControllers.updateAdmin)
    .put('/admins/:id/password', [verifyToken], AdminControllers.updateAdminPassword)
    .delete('/admins/:id', [verifyToken], AdminControllers.deleteAdmin);

router.post('/stocks', [verifyToken], StockControllers.createStocks);
router.get('/stocks/codes', [verifyToken], StockControllers.getAllStockCodes);

router.get('/targets', [verifyToken], TargetControllers.getAllTargets);
router.post('/targets', [verifyToken], TargetControllers.createTarget);
router.put('/targets/:id', [verifyToken], TargetControllers.updateTarget);
router.delete('/targets/:id', [verifyToken], TargetControllers.deleteTarget);

router.get('/targets/:targetId/news', [verifyToken], NewstControllers.getAllNews);
router.get('/news/:newsId', [verifyToken], NewstControllers.getNews);
router.post('/news', [verifyToken], NewstControllers.createNews);
router.put('/news/:id', [verifyToken], NewstControllers.updateNews);
router.delete('/news/:id', [verifyToken], NewstControllers.deleteNews);
router.get('/targets/:targetId/news/names', [verifyToken], NewstControllers.getAllNames);

router.get('/trackings/:newsId', [verifyToken], TrackingtControllers.getAllTrackings);
router.post('/trackings', [verifyToken], TrackingtControllers.createTracking);
router.put('/trackings/:id', [verifyToken], TrackingtControllers.updateTracking);
router.delete('/trackings/:id', [verifyToken], TrackingtControllers.deleteTracking);

router.post('/jumps', [verifyToken], JumpControllers.createJumps);
router.get('/jumps', [verifyToken], JumpControllers.getAllJumps);
router.put('/jumpRecords/:id', [verifyToken], JumpControllers.updateJumpRecord);
router.delete('/jumpRecords/:id', [verifyToken], JumpControllers.deleteJumpsRecord);
router.delete('/jumps/:id', [verifyToken], JumpControllers.deleteJump);
router.post('/jumps/updateIfClosed', [verifyToken], JumpControllers.updateIfClosed);

module.exports = router;
