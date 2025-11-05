/** HnmTV Module (hanime.tv)
 * This module provides access to hanime.tv content.
 * It supports browsing by tags/categories and streaming videos.
 */

///////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////       Main Functions          //////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////

/** searchResults
 * Searches for videos by tag/category on hanime.tv
 * @param {string} keyword - The tag or category to browse (e.g., "glasses", "uncensored", "teacher")
 *                          Use "trending" or "recent" for latest videos
 * @returns {Promise<string>} - A JSON string of search results.
 */
async function searchResults(keyword) {
    try {
        const slug = keyword.trim().toLowerCase().replace(/\s+/g, "-");
        console.log("Searching for:", slug);

        // Determine which browse endpoint to use
        let browseUrl;
        if (slug === "trending" || slug === "recent" || slug === "latest") {
            browseUrl = `https://hanime.tv/browse/trending`;
        } else if (slug === "random") {
            browseUrl = `https://hanime.tv/browse/random`;
        } else {
            // Try tag-based browsing
            browseUrl = `https://hanime.tv/browse/tags/${slug}`;
        }

        const responseText = await soraFetch(browseUrl);
        const html = await responseText.text();

        // Extract the __NUXT__ data from the page
        const nuxtMatch = html.match(/window\.__NUXT__\s*=\s*({.+?});?\s*<\/script>/s);
        if (!nuxtMatch) {
            console.log("Could not find __NUXT__ data, trying trending as fallback");
            // Fallback to trending if tag doesn't exist
            return await fetchTrending();
        }

        // Parse the NUXT data
        const nuxtData = JSON.parse(nuxtMatch[1]);

        // Navigate to the videos array
        let videos = [];
        if (nuxtData && nuxtData.data && nuxtData.data[0] && nuxtData.data[0].hentai_videos) {
            videos = nuxtData.data[0].hentai_videos;
        }

        // If no videos found with this tag, try trending as fallback
        if (!videos || videos.length === 0) {
            console.log("No videos found for tag, trying trending");
            return await fetchTrending();
        }

        const transformedResults = videos.map(video => ({
            title: video.name || "Untitled",
            image: video.cover_url || `https://hanime-cdn.com/images/covers/${video.slug}-cv1.png`,
            href: `https://hanime.tv/videos/hentai/${video.slug}`
        }));

        console.log("Found videos:", transformedResults.length);
        return JSON.stringify(transformedResults);
    } catch (error) {
        console.log('Search error:', error);
        // Try trending as last resort fallback
        try {
            return await fetchTrending();
        } catch (e) {
            return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
        }
    }
}

/** fetchTrending
 * Helper function to fetch trending videos as fallback
 * @returns {Promise<string>} - A JSON string of trending videos
 */
async function fetchTrending() {
    try {
        const responseText = await soraFetch(`https://hanime.tv/browse/trending`);
        const html = await responseText.text();

        const nuxtMatch = html.match(/window\.__NUXT__\s*=\s*({.+?});?\s*<\/script>/s);
        if (!nuxtMatch) {
            return JSON.stringify([]);
        }

        const nuxtData = JSON.parse(nuxtMatch[1]);
        let videos = [];
        if (nuxtData && nuxtData.data && nuxtData.data[0] && nuxtData.data[0].hentai_videos) {
            videos = nuxtData.data[0].hentai_videos;
        }

        const transformedResults = videos.map(video => ({
            title: video.name || "Untitled",
            image: video.cover_url || `https://hanime-cdn.com/images/covers/${video.slug}-cv1.png`,
            href: `https://hanime.tv/videos/hentai/${video.slug}`
        }));

        console.log("Fetched trending videos:", transformedResults.length);
        return JSON.stringify(transformedResults);
    } catch (error) {
        console.log('Trending fetch error:', error);
        return JSON.stringify([]);
    }
}

/** extractDetails
 * Extracts details of a video from its page URL.
 * @param {string} url - The URL of the video page.
 * @returns {Promise<string>} - A JSON string of the video details.
 */
async function extractDetails(url) {
    try {
        const response = await soraFetch(url);
        const html = await response.text();

        // Extract the __NUXT__ data from the page
        const nuxtMatch = html.match(/window\.__NUXT__\s*=\s*({.+?});?\s*<\/script>/s);
        if (!nuxtMatch) {
            console.log("Could not find __NUXT__ data");
            return JSON.stringify([{
                description: 'Error loading description',
                aliases: 'Unknown',
                airdate: 'Released: Unknown'
            }]);
        }

        const nuxtData = JSON.parse(nuxtMatch[1]);

        // Navigate to video info
        let videoInfo = null;
        if (nuxtData && nuxtData.data && nuxtData.data[0] && nuxtData.data[0].hentai_video) {
            videoInfo = nuxtData.data[0].hentai_video;
        }

        if (!videoInfo) {
            throw new Error("Video info not found");
        }

        const description = videoInfo.description || 'No description available';
        const tags = videoInfo.hentai_tags ? videoInfo.hentai_tags.map(tag => tag.text).join(', ') : 'None';
        const brand = videoInfo.brand ? videoInfo.brand.title : 'Unknown';
        const views = videoInfo.views ? videoInfo.views.toLocaleString() : '0';

        const aliases = `Tags: ${tags}\nBrand: ${brand}\nViews: ${views}`;
        const airdate = `Released: ${videoInfo.released_at_unix ? new Date(videoInfo.released_at_unix * 1000).toLocaleDateString() : 'Unknown'}`;

        const transformedResults = [{
            description,
            aliases,
            airdate
        }];

        console.log("Extracted details successfully");
        return JSON.stringify(transformedResults);
    } catch (error) {
        console.log('Details error:', error);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Unknown',
            airdate: 'Released: Unknown'
        }]);
    }
}

/** extractEpisodes
 * Extracts episodes/variants of a video from its page URL.
 * @param {string} url - The URL of the video page.
 * @returns {Promise<string>} - A JSON string of the video episodes.
 */
async function extractEpisodes(url) {
    try {
        const response = await soraFetch(url);
        const html = await response.text();

        // Extract the __NUXT__ data from the page
        const nuxtMatch = html.match(/window\.__NUXT__\s*=\s*({.+?});?\s*<\/script>/s);
        if (!nuxtMatch) {
            console.log("Could not find __NUXT__ data");
            return JSON.stringify([]);
        }

        const nuxtData = JSON.parse(nuxtMatch[1]);

        // Navigate to video info
        let videoInfo = null;
        if (nuxtData && nuxtData.data && nuxtData.data[0] && nuxtData.data[0].hentai_video) {
            videoInfo = nuxtData.data[0].hentai_video;
        }

        if (!videoInfo) {
            throw new Error("Video info not found");
        }

        // Check for franchise episodes
        const episodes = [];

        if (videoInfo.hentai_franchise_hentai_videos && videoInfo.hentai_franchise_hentai_videos.length > 0) {
            // This video is part of a series/franchise
            videoInfo.hentai_franchise_hentai_videos.forEach((ep, index) => {
                episodes.push({
                    href: `https://hanime.tv/videos/hentai/${ep.slug}`,
                    number: index + 1,
                    title: ep.name || `Episode ${index + 1}`
                });
            });
        } else {
            // Single video, return as one episode
            episodes.push({
                href: url,
                number: 1,
                title: videoInfo.name || "Full Video"
            });
        }

        console.log("Found episodes:", episodes.length);
        return JSON.stringify(episodes);
    } catch (error) {
        console.log('Episodes error:', error);
        return JSON.stringify([]);
    }
}

/** extractStreamUrl
 * Extracts the stream URL of a video from its page URL.
 * @param {string} url - The URL of the video page.
 * @returns {Promise<string|null>} - The stream URL or null if not found.
 */
async function extractStreamUrl(url) {
    try {
        const response = await soraFetch(url);
        const html = await response.text();

        // Extract the __NUXT__ data from the page
        const nuxtMatch = html.match(/window\.__NUXT__\s*=\s*({.+?});?\s*<\/script>/s);
        if (!nuxtMatch) {
            console.log("Could not find __NUXT__ data");
            return null;
        }

        const nuxtData = JSON.parse(nuxtMatch[1]);

        // Navigate to video streams
        let videosManifest = null;
        if (nuxtData && nuxtData.data && nuxtData.data[0] && nuxtData.data[0].videos_manifest) {
            videosManifest = nuxtData.data[0].videos_manifest;
        }

        if (!videosManifest || !videosManifest.servers || videosManifest.servers.length === 0) {
            console.log("No video servers found");
            return null;
        }

        const streams = [];

        // Get streams from the first server
        const server = videosManifest.servers[0];
        if (server.streams && server.streams.length > 0) {
            // Sort streams by resolution (highest first)
            const sortedStreams = server.streams.sort((a, b) => (b.height || 0) - (a.height || 0));

            for (const stream of sortedStreams) {
                if (stream.url) {
                    const quality = stream.height ? `${stream.height}p` : 'Unknown';
                    streams.push(`${quality}`, stream.url);
                }
            }
        }

        if (streams.length === 0) {
            console.log("No valid streams found");
            return null;
        }

        const result = {
            streams: streams,
            subtitles: ""
        };

        console.log("Extracted stream URLs successfully");
        return JSON.stringify(result);
    } catch (error) {
        console.log('Stream extraction error:', error);
        return null;
    }
}

///////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////       Helper Functions        //////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////

/** soraFetch
 * Fetch function that tries to use a custom fetch implementation first,
 * and falls back to the native fetch if it fails.
 * @param {string} url - The URL to fetch.
 * @param {Object} options - The options for the fetch request.
 * @returns {Promise<Response|null>} - The response object or null if an error occurs.
 */
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch(e) {
        try {
            return await fetch(url, options);
        } catch(error) {
            await console.log('soraFetch error: ' + error.message);
            return null;
        }
    }
}
