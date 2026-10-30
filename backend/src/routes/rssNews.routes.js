const { Router } = require('express');
const rssNewsController = require('../controllers/rssNews.controller');
const { authenticate, optionalAuthenticate } = require('../middlewares/auth.middleware');
const { requireContentPolicy } = require('../middlewares/contentPolicy.middleware');

const router = Router();

/**
 * Public endpoints consumed by Frontend (`web/src/api/news.ts` & `NewsSection.tsx`)
 */
router.get('/news/latest', rssNewsController.getLatestNews);
router.get('/news/source/:id', optionalAuthenticate, rssNewsController.getNewsBySource);

/**
 * Protected Content Management endpoints (UC-ADM-09: requires Content Policy)
 */
router.use(authenticate, requireContentPolicy);

router.get('/policy', rssNewsController.getContentPolicyInfo);
router.get('/news', rssNewsController.queryManagedNews);

router.get('/', rssNewsController.listSources);
router.post('/', rssNewsController.createSource);
router.post('/create', rssNewsController.createSource);

router.get('/:id', rssNewsController.getSourceDetail);
router.put('/update/:id', rssNewsController.updateSource);
router.put('/:id', rssNewsController.updateSource);
router.patch('/:id', rssNewsController.updateSource);

router.patch('/:id/disable', rssNewsController.disableSource);
router.put('/:id/disable', rssNewsController.disableSource);
router.patch('/:id/enable', rssNewsController.enableSource);
router.put('/:id/enable', rssNewsController.enableSource);
router.patch('/:id/status', rssNewsController.setSourceStatus);

router.post('/:id/sync', rssNewsController.syncSourceFeed);
router.post('/:id/import', rssNewsController.syncSourceFeed);

module.exports = router;

