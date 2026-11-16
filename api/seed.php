<?php
declare(strict_types=1);

// Seeds demo data (20 users with songs, setlists, gigs, a band and connections).
// Usage: php api/seed.php   (uses api/config.php or GMP_DB_* env vars, like the API)
// CLI only: never reachable over HTTP.

if (PHP_SAPI !== 'cli' || php_sapi_name() !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/migrate.php';
require __DIR__ . '/lib/songs.php';

const SEED_USER_COUNT = 20;
const SEED_SONGS_PER_USER = 15;
const SEED_SETLISTS_PER_USER = 3;
const SEED_SONGS_PER_SETLIST = 5;
const SEED_PASSWORD = 'Password1!';

// [title, artist, album, release year, duration seconds, tempo]
const SEED_CATALOG = [
    'rock' => [
        ['Back in Black', 'AC/DC', 'Back in Black', 1980, 255, 94],
        ['Hotel California', 'Eagles', 'Hotel California', 1976, 391, 75],
        ['Sweet Child O\' Mine', 'Guns N\' Roses', 'Appetite for Destruction', 1987, 356, 125],
        ['Born to Run', 'Bruce Springsteen', 'Born to Run', 1975, 270, 147],
        ['Baba O\'Riley', 'The Who', 'Who\'s Next', 1971, 308, 117],
        ['Satisfaction', 'The Rolling Stones', 'Out of Our Heads', 1965, 223, 136],
        ['Mr. Brightside', 'The Killers', 'Hot Fuss', 2004, 222, 148],
        ['Black Hole Sun', 'Soundgarden', 'Superunknown', 1994, 318, 105],
    ],
    'blues' => [
        ['The Thrill Is Gone', 'B.B. King', 'Completely Well', 1969, 325, 92],
        ['Pride and Joy', 'Stevie Ray Vaughan', 'Texas Flood', 1983, 220, 118],
        ['Crossroads', 'Cream', 'Wheels of Fire', 1968, 258, 128],
        ['Hoochie Coochie Man', 'Muddy Waters', 'The Best of Muddy Waters', 1954, 172, 85],
        ['Sweet Home Chicago', 'Robert Johnson', 'King of the Delta Blues Singers', 1936, 178, 98],
        ['Born Under a Bad Sign', 'Albert King', 'Born Under a Bad Sign', 1967, 168, 100],
        ['Boom Boom', 'John Lee Hooker', 'Burnin\'', 1962, 150, 170],
        ['Red House', 'Jimi Hendrix', 'Are You Experienced', 1967, 224, 64],
    ],
    'jazz' => [
        ['So What', 'Miles Davis', 'Kind of Blue', 1959, 562, 136],
        ['Take Five', 'The Dave Brubeck Quartet', 'Time Out', 1959, 324, 172],
        ['Autumn Leaves', 'Cannonball Adderley', 'Somethin\' Else', 1958, 660, 120],
        ['Fly Me to the Moon', 'Frank Sinatra', 'It Might as Well Be Swing', 1964, 148, 120],
        ['Blue Bossa', 'Joe Henderson', 'Page One', 1963, 480, 150],
        ['Cantaloupe Island', 'Herbie Hancock', 'Empyrean Isles', 1964, 330, 112],
        ['Summertime', 'Ella Fitzgerald & Louis Armstrong', 'Porgy and Bess', 1957, 298, 70],
        ['Watermelon Man', 'Herbie Hancock', 'Takin\' Off', 1962, 431, 130],
    ],
    'country' => [
        ['Friends in Low Places', 'Garth Brooks', 'No Fences', 1990, 258, 92],
        ['Jolene', 'Dolly Parton', 'Jolene', 1973, 162, 110],
        ['Ring of Fire', 'Johnny Cash', 'Ring of Fire: The Best of Johnny Cash', 1963, 157, 105],
        ['Take Me Home, Country Roads', 'John Denver', 'Poems, Prayers & Promises', 1971, 190, 82],
        ['Mama Tried', 'Merle Haggard', 'Mama Tried', 1968, 132, 116],
        ['On the Road Again', 'Willie Nelson', 'Honeysuckle Rose', 1980, 153, 110],
        ['Tennessee Whiskey', 'Chris Stapleton', 'Traveller', 2015, 293, 48],
        ['Wagon Wheel', 'Old Crow Medicine Show', 'O.C.M.S.', 2004, 222, 148],
    ],
    'pop' => [
        ['Billie Jean', 'Michael Jackson', 'Thriller', 1982, 294, 117],
        ['Dancing Queen', 'ABBA', 'Arrival', 1976, 231, 101],
        ['Uptown Funk', 'Mark Ronson ft. Bruno Mars', 'Uptown Special', 2014, 270, 115],
        ['Shake It Off', 'Taylor Swift', '1989', 2014, 219, 160],
        ['I Wanna Dance with Somebody', 'Whitney Houston', 'Whitney', 1987, 291, 119],
        ['Valerie', 'Amy Winehouse', 'Back to Black (Deluxe)', 2007, 233, 108],
        ['Shallow', 'Lady Gaga & Bradley Cooper', 'A Star Is Born', 2018, 216, 96],
        ['Don\'t Stop Believin\'', 'Journey', 'Escape', 1981, 251, 119],
    ],
    'folk' => [
        ['The Times They Are a-Changin\'', 'Bob Dylan', 'The Times They Are a-Changin\'', 1964, 195, 88],
        ['Fast Car', 'Tracy Chapman', 'Tracy Chapman', 1988, 296, 104],
        ['The Boxer', 'Simon & Garfunkel', 'Bridge over Troubled Water', 1970, 308, 80],
        ['Big Yellow Taxi', 'Joni Mitchell', 'Ladies of the Canyon', 1970, 135, 172],
        ['Ho Hey', 'The Lumineers', 'The Lumineers', 2012, 163, 80],
        ['Fire and Rain', 'James Taylor', 'Sweet Baby James', 1970, 200, 76],
        ['Little Lion Man', 'Mumford & Sons', 'Sigh No More', 2009, 245, 139],
        ['This Land Is Your Land', 'Woody Guthrie', 'This Land Is Your Land', 1944, 166, 96],
    ],
    'metal' => [
        ['Enter Sandman', 'Metallica', 'Metallica', 1991, 331, 123],
        ['Paranoid', 'Black Sabbath', 'Paranoid', 1970, 168, 163],
        ['The Trooper', 'Iron Maiden', 'Piece of Mind', 1983, 250, 160],
        ['Breaking the Law', 'Judas Priest', 'British Steel', 1980, 155, 165],
        ['Ace of Spades', 'Motörhead', 'Ace of Spades', 1980, 169, 280],
        ['Chop Suey!', 'System of a Down', 'Toxicity', 2001, 210, 127],
        ['Crazy Train', 'Ozzy Osbourne', 'Blizzard of Ozz', 1980, 296, 138],
        ['Walk', 'Pantera', 'Vulgar Display of Power', 1992, 315, 115],
    ],
    'punk' => [
        ['Blitzkrieg Bop', 'Ramones', 'Ramones', 1976, 133, 177],
        ['London Calling', 'The Clash', 'London Calling', 1979, 199, 134],
        ['Basket Case', 'Green Day', 'Dookie', 1994, 181, 175],
        ['Anarchy in the U.K.', 'Sex Pistols', 'Never Mind the Bollocks', 1977, 212, 138],
        ['Ruby Soho', 'Rancid', '...And Out Come the Wolves', 1995, 158, 184],
        ['Holiday in Cambodia', 'Dead Kennedys', 'Fresh Fruit for Rotting Vegetables', 1980, 225, 150],
        ['Self Esteem', 'The Offspring', 'Smash', 1994, 257, 104],
        ['All the Small Things', 'blink-182', 'Enema of the State', 1999, 168, 148],
    ],
    'funk' => [
        ['Superstition', 'Stevie Wonder', 'Talking Book', 1972, 266, 100],
        ['Get Up (I Feel Like Being a) Sex Machine', 'James Brown', 'Sex Machine', 1970, 318, 110],
        ['Play That Funky Music', 'Wild Cherry', 'Wild Cherry', 1976, 302, 109],
        ['Give Up the Funk (Tear the Roof off the Sucker)', 'Parliament', 'Mothership Connection', 1975, 346, 106],
        ['Le Freak', 'Chic', 'C\'est Chic', 1978, 330, 120],
        ['Pick Up the Pieces', 'Average White Band', 'AWB', 1974, 240, 110],
        ['Cissy Strut', 'The Meters', 'The Meters', 1969, 185, 88],
        ['September', 'Earth, Wind & Fire', 'The Best of Earth, Wind & Fire, Vol. 1', 1978, 215, 126],
    ],
    'reggae' => [
        ['Three Little Birds', 'Bob Marley & The Wailers', 'Exodus', 1977, 180, 76],
        ['Red Red Wine', 'UB40', 'Labour of Love', 1983, 320, 90],
        ['The Harder They Come', 'Jimmy Cliff', 'The Harder They Come', 1972, 225, 78],
        ['Israelites', 'Desmond Dekker', 'Israelites', 1968, 158, 112],
        ['Pressure Drop', 'Toots & The Maytals', 'The Harder They Come', 1970, 205, 118],
        ['Stir It Up', 'Bob Marley & The Wailers', 'Catch a Fire', 1973, 333, 74],
        ['Bam Bam', 'Sister Nancy', 'One Two', 1982, 210, 85],
        ['Could You Be Loved', 'Bob Marley & The Wailers', 'Uprising', 1980, 237, 103],
    ],
];

// [first name, last name, instrument, genre, city, state, zip, lat, lng, other instruments]
const SEED_PEOPLE = [
    ['Alex', 'Rivera', 'Guitar', 'rock', 'Austin', 'TX', '78701', 30.2711, -97.7437, ['Vocals']],
    ['Jordan', 'Lee', 'Bass', 'funk', 'Austin', 'TX', '78704', 30.2428, -97.7658, ['Keys']],
    ['Sam', 'Patel', 'Drums', 'rock', 'Round Rock', 'TX', '78664', 30.5083, -97.6789, ['Percussion']],
    ['Taylor', 'Nguyen', 'Keys', 'jazz', 'San Marcos', 'TX', '78666', 29.8833, -97.9414, ['Synth', 'Vocals']],
    ['Casey', 'Morgan', 'Vocals', 'country', 'Nashville', 'TN', '37203', 36.1507, -86.7896, ['Acoustic Guitar']],
    ['Riley', 'Brooks', 'Fiddle', 'country', 'Franklin', 'TN', '37064', 35.9251, -86.8689, ['Mandolin']],
    ['Morgan', 'Hayes', 'Saxophone', 'jazz', 'New Orleans', 'LA', '70116', 29.9683, -90.0603, ['Clarinet', 'Flute']],
    ['Jamie', 'Fox', 'Trumpet', 'funk', 'New Orleans', 'LA', '70130', 29.9389, -90.0702, ['Flugelhorn']],
    ['Drew', 'Carter', 'Guitar', 'blues', 'Chicago', 'IL', '60616', 41.8455, -87.6247, ['Harmonica']],
    ['Quinn', 'Sullivan', 'Harmonica', 'blues', 'Chicago', 'IL', '60657', 41.9400, -87.6537, ['Vocals']],
    ['Avery', 'Kim', 'Vocals', 'pop', 'Los Angeles', 'CA', '90028', 34.0998, -118.3267, ['Keys']],
    ['Parker', 'Diaz', 'Guitar', 'punk', 'Los Angeles', 'CA', '90026', 34.0766, -118.2646, ['Bass']],
    ['Rowan', 'Ellis', 'Banjo', 'folk', 'Asheville', 'NC', '28801', 35.5951, -82.5515, ['Acoustic Guitar', 'Vocals']],
    ['Skyler', 'Grant', 'Cello', 'folk', 'Portland', 'OR', '97205', 45.5202, -122.6866, ['Upright Bass']],
    ['Reese', 'Turner', 'Drums', 'metal', 'Seattle', 'WA', '98101', 47.6101, -122.3344, []],
    ['Emerson', 'Wu', 'Guitar', 'metal', 'Tacoma', 'WA', '98402', 47.2529, -122.4443, ['Bass']],
    ['Finley', 'Ross', 'Bass', 'reggae', 'Miami', 'FL', '33139', 25.7826, -80.1341, ['Vocals']],
    ['Harper', 'Bell', 'Keys', 'reggae', 'Fort Lauderdale', 'FL', '33301', 26.1224, -80.1373, ['Organ', 'Melodica']],
    ['Hayden', 'Price', 'Vocals', 'punk', 'Denver', 'CO', '80205', 39.7589, -104.9666, ['Guitar']],
    ['Kendall', 'Shaw', 'Guitar', 'pop', 'Denver', 'CO', '80211', 39.7660, -105.0198, ['Ukulele', 'Vocals']],
];

const SEED_ORIGINALS = [
    ['Highway Lights', 312, 128], ['Last Call at the Lantern', 244, 96], ['Paper Moon Motel', 276, 84],
    ['Static on the Radio', 198, 152], ['River Town', 231, 104], ['Neon Ghosts', 263, 118],
    ['Saltwater Hymn', 289, 72],
];

const SEED_EXPERIENCE = ['beginner', 'intermediate', 'advanced', 'professional'];
const SEED_COMMITMENT = ['casual', 'serious', 'professional'];

function seed_log(string $msg): void
{
    fwrite(STDOUT, $msg . PHP_EOL);
}

/** Picks one user's songs: mostly from their main genre, the rest spread over the others. */
function seed_pick_songs(string $mainGenre, int $count): array
{
    $main = SEED_CATALOG[$mainGenre];
    shuffle($main);
    $picked = array_map(static fn ($s) => $s + [6 => $mainGenre], array_slice($main, 0, 6));

    $others = [];
    foreach (SEED_CATALOG as $genre => $songs) {
        if ($genre !== $mainGenre) {
            foreach ($songs as $s) {
                $others[] = $s + [6 => $genre];
            }
        }
    }
    shuffle($others);
    return array_slice(array_merge($picked, $others), 0, $count);
}

function seed_counts(): array
{
    $tables = ['users', 'profiles', 'songs', 'setlists', 'setlist_songs', 'gigs', 'gig_setlists', 'bands', 'band_members', 'band_songs', 'band_setlists', 'band_gigs'];
    $counts = [];
    foreach ($tables as $t) {
        $counts[$t] = (int) q_val("SELECT COUNT(*) FROM `{$t}`");
    }
    $counts['user_connections (accepted)'] = (int) q_val("SELECT COUNT(*) FROM user_connections WHERE status = 'accepted'");
    return $counts;
}

function seed_run(): void
{
    run_migrations();

    if (q_val('SELECT id FROM users WHERE email = ?', ['user1@example.com']) !== null) {
        seed_log('Seed data already present (user1@example.com exists); nothing to do.');
        return;
    }

    mt_srand(9120);
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $hash = password_hash(SEED_PASSWORD, PASSWORD_DEFAULT);
        $now = now_sql();
        $userIds = [];
        $songsByUser = [];
        $setlistsByUser = [];
        $originalIndex = 0;

        foreach (SEED_PEOPLE as $i => $p) {
            $n = $i + 1;
            [$first, $last, $instrument, $genre, $city, $state, $zip, $lat, $lng, $extra] = $p;

            q('INSERT INTO users (email, password_hash, email_verified_at) VALUES (?,?,?)', ["user{$n}@example.com", $hash, $now]);
            $uid = (int) $pdo->lastInsertId();
            $userIds[$n] = $uid;

            q(
                'INSERT INTO profiles (id, username, display_name, bio, location, city, state, zip, instrument, genre, instruments,
                    experience_level, commitment_level, is_public, latitude, longitude, calendar_token)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)',
                [
                    $uid, strtolower($first . $last) . $n, "{$first} {$last}",
                    "{$instrument} player into {$genre}, based in {$city}. Always up for a jam.",
                    "{$city}, {$state}", $city, $state, $zip, $instrument, $genre,
                    json_encode(array_values(array_merge([$instrument], $extra))),
                    SEED_EXPERIENCE[$i % 4], SEED_COMMITMENT[$i % 3], $lat, $lng, random_token(16),
                ]
            );

            $songs = seed_pick_songs($genre, SEED_SONGS_PER_USER);
            if ($i % 3 === 0) {
                [$otitle, $odur, $otempo] = SEED_ORIGINALS[$originalIndex++ % count(SEED_ORIGINALS)];
                $songs[SEED_SONGS_PER_USER - 1] = [$otitle, "{$first} {$last}", '', (int) date('Y'), $odur, $otempo, $genre, true];
            }
            foreach ($songs as $s) {
                $isOriginal = !empty($s[7]);
                q(
                    'INSERT INTO songs (user_id, title, artist, album, release_date, `key`, tempo, duration, genre, is_original)
                     VALUES (?,?,?,?,?,?,?,?,?,?)',
                    [
                        $uid, $s[0], $s[1], $s[2], $isOriginal ? null : sprintf('%04d-01-01', $s[3]),
                        SONG_KEYS[mt_rand(0, count(SONG_KEYS) - 1)], max(40, min(300, $s[5])), $s[4], $s[6], $isOriginal ? 1 : 0,
                    ]
                );
                $songsByUser[$uid][] = ['id' => (int) $pdo->lastInsertId(), 'duration' => $s[4]];
            }

            $setNames = ["{$first}'s Opening Set", "{$first}'s Main Set", "{$first}'s Encore"];
            $pool = $songsByUser[$uid];
            shuffle($pool);
            for ($k = 0; $k < SEED_SETLISTS_PER_USER; $k++) {
                $chosen = array_slice($pool, $k * SEED_SONGS_PER_SETLIST, SEED_SONGS_PER_SETLIST);
                $duration = array_sum(array_column($chosen, 'duration'));
                q(
                    'INSERT INTO setlists (user_id, name, description, duration, is_public) VALUES (?,?,?,?,?)',
                    [$uid, $setNames[$k], ucfirst($genre) . ' set', $duration, $k === 1 ? 1 : 0]
                );
                $setlistId = (int) $pdo->lastInsertId();
                $setlistsByUser[$uid][] = ['id' => $setlistId, 'duration' => $duration];
                foreach ($chosen as $pos => $song) {
                    q('INSERT INTO setlist_songs (setlist_id, song_id, position) VALUES (?,?,?)', [$setlistId, $song['id'], $pos + 1]);
                }
            }
        }

        // [user #, name, venue, location, days ahead, hour (UTC), payment, status, setlist indexes]
        $gigs = [
            [1, 'Friday Night Rock Show', 'The Continental Club', '1315 S Congress Ave, Austin, TX', 14, 2, 350.00, 'confirmed', [0, 1]],
            [1, 'Brewery Patio Set', 'Zilker Brewing Co.', '1701 E 6th St, Austin, TX', 30, 23, 200.00, 'scheduled', [1]],
            [5, 'Honky Tonk Saturday', 'Robert\'s Western World', '416 Broadway, Nashville, TN', 21, 1, 275.00, 'confirmed', [0, 2]],
            [9, 'Blues Jam Night', 'Kingston Mines', '2548 N Halsted St, Chicago, IL', 45, 3, 150.00, 'scheduled', [1]],
        ];
        $gigIds = [];
        foreach ($gigs as [$n, $name, $venue, $location, $days, $hour, $payment, $status, $setIdx]) {
            $uid = $userIds[$n];
            $start = (new DateTimeImmutable('today', new DateTimeZone('UTC')))->modify("+{$days} days")->setTime($hour, 0);
            $linked = array_map(static fn ($idx) => $setlistsByUser[$uid][$idx], $setIdx);
            $minutes = (int) ceil(array_sum(array_column($linked, 'duration')) / 60);
            q(
                'INSERT INTO gigs (user_id, name, venue, location, date_time, load_in_time, duration, notes, payment, status)
                 VALUES (?,?,?,?,?,?,?,?,?,?)',
                [
                    $uid, $name, $venue, $location, $start->format('Y-m-d H:i:s'),
                    $start->modify('-90 minutes')->format('Y-m-d H:i:s'), $minutes, 'Load in through the side door.', $payment, $status,
                ]
            );
            $gigId = (int) $pdo->lastInsertId();
            $gigIds[$n][] = $gigId;
            foreach ($linked as $pos => $setlist) {
                q('INSERT INTO gig_setlists (gig_id, setlist_id, position) VALUES (?,?,?)', [$gigId, $setlist['id'], $pos + 1]);
            }
        }

        $owner = $userIds[1];
        q(
            'INSERT INTO bands (name, description, owner_id, is_public) VALUES (?,?,?,1)',
            ['The Sixth Street Revival', 'Austin rock and funk four-piece playing originals and covers.', $owner]
        );
        $bandId = (int) $pdo->lastInsertId();
        $members = [[1, 'owner', 1], [2, 'admin', 1], [3, 'member', 0], [4, 'member', 0]];
        foreach ($members as [$n, $role, $canEdit]) {
            q('INSERT INTO band_members (band_id, user_id, role, can_edit) VALUES (?,?,?,?)', [$bandId, $userIds[$n], $role, $canEdit]);
        }
        foreach ([1, 2, 3, 4] as $n) {
            $uid = $userIds[$n];
            foreach (array_slice($songsByUser[$uid], 0, 3) as $song) {
                q('INSERT INTO band_songs (band_id, song_id, added_by) VALUES (?,?,?)', [$bandId, $song['id'], $uid]);
            }
        }
        foreach ([1, 2] as $n) {
            $uid = $userIds[$n];
            q('INSERT INTO band_setlists (band_id, setlist_id, added_by) VALUES (?,?,?)', [$bandId, $setlistsByUser[$uid][1]['id'], $uid]);
        }
        q('INSERT INTO band_gigs (band_id, gig_id, added_by) VALUES (?,?,?)', [$bandId, $gigIds[1][0], $owner]);

        $pairs = [[1, 2], [1, 3], [2, 4], [5, 6], [7, 8], [9, 10], [11, 20], [12, 19], [13, 14], [15, 16]];
        $notes = ['Great playing at the jam last week!', 'Let\'s set up a rehearsal.', 'Loved your last set.', 'Want to trade some charts?'];
        foreach ($pairs as $k => [$a, $b]) {
            q(
                'INSERT INTO user_connections (requester_id, recipient_id, status, message) VALUES (?,?,\'accepted\',?)',
                [$userIds[$a], $userIds[$b], $notes[$k % count($notes)]]
            );
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    seed_log('Seeded demo data. Log in as user1@example.com … user20@example.com with password ' . SEED_PASSWORD);
}

try {
    seed_run();
    foreach (seed_counts() as $table => $count) {
        seed_log(sprintf('  %-28s %d', $table, $count));
    }
} catch (HttpError $e) {
    fwrite(STDERR, 'Error: ' . $e->getMessage() . (isset($e->extra['detail']) ? ' (' . $e->extra['detail'] . ')' : '') . PHP_EOL);
    exit(1);
} catch (Throwable $e) {
    fwrite(STDERR, 'Seed failed: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
