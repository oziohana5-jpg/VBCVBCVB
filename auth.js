// ============================================================
// Discord OAuth2 - Passport strategy + routes
// ============================================================
const express          = require('express');
const passport         = require('passport');
const DiscordStrategy  = require('passport-discord').Strategy;

const router = express.Router();

// ── Passport serialize / deserialize ─────────────────────────
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ── Discord strategy ──────────────────────────────────────────
// Only register if credentials are present (allows running without Discord)
const DISCORD_CLIENT_ID     = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_CALLBACK_URL  = process.env.DISCORD_CALLBACK_URL
  || 'http://localhost:3000/auth/discord/callback';

if (DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET) {
  passport.use(new DiscordStrategy(
    {
      clientID:     DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      callbackURL:  DISCORD_CALLBACK_URL,
      scope:        ['identify'],
    },
    (accessToken, refreshToken, profile, done) => {
      // profile fields: id, username, discriminator, avatar, ...
      const user = {
        id:            profile.id,
        username:      profile.username,
        discriminator: profile.discriminator,
        avatar:        profile.avatar,
        accessToken,
      };
      return done(null, user);
    }
  ));
  console.log('[auth] Discord OAuth configured');
} else {
  console.warn('[auth] DISCORD_CLIENT_ID / SECRET missing - OAuth disabled. Set them in .env');
}

// ── Routes ────────────────────────────────────────────────────

// Start OAuth flow
router.get('/discord', (req, res, next) => {
  if (!DISCORD_CLIENT_ID) {
    return res.redirect('/?error=discord_not_configured');
  }
  passport.authenticate('discord')(req, res, next);
});

// OAuth callback
router.get('/discord/callback',
  (req, res, next) => {
    if (!DISCORD_CLIENT_ID) return res.redirect('/?error=discord_not_configured');
    next();
  },
  passport.authenticate('discord', { failureRedirect: '/?error=discord_auth_failed' }),
  (req, res) => {
    res.redirect('/?loggedIn=1');
  }
);

// Logout
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

module.exports = router;
