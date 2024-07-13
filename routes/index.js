const { Router } = require('express');
const router = Router();
const TargetControllers = require('../controllers/target');
const TrackingControllers = require('../controllers/tracking');
const AdminControllers = require('../controllers/admin');
const StockControllers = require('../controllers/stock');
const JumpControllers = require('../controllers/jump');
const ContractControllers = require('../controllers/contract');
const NewsControllers = require('../controllers/news');
const ObserveControllers = require('../controllers/observe');
const QuoteControllers = require('../controllers/quote');
const verifyToken = require('../middlewares/authJwt');

router.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

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

router.get('/targets/:targetId/news', [verifyToken], NewsControllers.getAllNews);
router.get('/news/:newsId', [verifyToken], NewsControllers.getNews);
router.post('/news', [verifyToken], NewsControllers.createNews);
router.put('/news/:id', [verifyToken], NewsControllers.updateNews);
router.delete('/news/:id', [verifyToken], NewsControllers.deleteNews);
router.get('/targets/:targetId/news/names', [verifyToken], NewsControllers.getAllNames);

router.get('/trackings', TrackingControllers.getAllTrackings);
router.post('/trackings', [verifyToken], TrackingControllers.createTracking);

router.post('/jumps', [verifyToken], JumpControllers.createJumps);
router.get('/jumps', [verifyToken], JumpControllers.getAllJumps);
router.put('/jumpRecords/:id', [verifyToken], JumpControllers.updateJumpRecord);
router.delete('/jumpRecords/:id', [verifyToken], JumpControllers.deleteJumpsRecord);
// router.delete('/bulkDelete/jumpRecords', [verifyToken], JumpControllers.deleteJumpsRecords);
router.delete('/jumps/:id', [verifyToken], JumpControllers.deleteJump);
router.post('/jumps/updateIfClosed', [verifyToken], JumpControllers.updateIfClosed);

router.post('/contracts', [verifyToken], ContractControllers.createContracts);
router.get('/contracts', [verifyToken], ContractControllers.getAllContracts);
router.get('/contracts/:code', [verifyToken], ContractControllers.getContract);

router.post('/observesRecords', [verifyToken], ObserveControllers.createObserveRecord);
router.get('/observes', [verifyToken], ObserveControllers.getAllObserves);
router.get('/observesRecords/:observeId', [verifyToken], ObserveControllers.getObservesRecords);
router.put('/observes/:id', [verifyToken], ObserveControllers.updateObserve);
router.put('/observesRecords/:id', [verifyToken], ObserveControllers.updateObservesRecord);
router.delete('/observes/:id', [verifyToken], ObserveControllers.deleteObserve);
router.delete('/observesRecords/:id', [verifyToken], ObserveControllers.deleteObservesRecord);


router.get('/quotes', [verifyToken], QuoteControllers.getAllQuotes);
router.post('/quotes', [verifyToken], QuoteControllers.createQuote);
router.put('/quotes/:id', [verifyToken], QuoteControllers.updateQuote);
router.delete('/quotes/:id', [verifyToken], QuoteControllers.deleteQuote);

module.exports = router;
