import { decrypt } from './db-postgres';
import logger from './logger';

export interface TwitterCookies {
  auth_token: string;
  ct0: string;
}

const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

// Working Query IDs (Updated November 15, 2024 - Extracted from live Twitter)
const WORKING_QUERY_IDS = {
  UserByScreenName: 'ZHSN3WlvahPKVvUxVQbg1A', // ✅ WORKING (Nov 15, 2024)
  Followers: 'OGScL-RC4DFMsRGOCjPR6g',
  Following: 'o5eNLkJb03ayTQa97Cpp7w',
  UserMedia: 'ophTtKkfXcUKnXlxh9fU5w',
};

// تحليل الكوكيز من صيغ مختلفة
export function parseCookies(input: string): TwitterCookies {
  try {
    const parsed = JSON.parse(input);
    
    // إذا كان array (من EditThisCookie)
    if (Array.isArray(parsed)) {
      const cookies: any = {};
      for (const item of parsed) {
        if (item.name === 'auth_token' || item.name === 'ct0') {
          cookies[item.name] = item.value;
        }
      }
      
      console.log('Parsed cookies from array:', cookies);
      
      if (!cookies.auth_token || !cookies.ct0) {
        throw new Error('Missing required cookies (auth_token, ct0)');
      }
      
      return cookies as TwitterCookies;
    }
    
    // إذا كان object
    if (parsed.auth_token && parsed.ct0) {
      console.log('Parsed cookies from object');
      return {
        auth_token: parsed.auth_token,
        ct0: parsed.ct0
      };
    }
    
    throw new Error('Invalid cookie format - missing auth_token or ct0');
  } catch (error) {
    console.error('Cookie parsing error:', error);
    throw new Error('Failed to parse cookies: ' + (error as Error).message);
  }
}

// التحقق من الحساب مع fallback تلقائي
export async function validateTwitterAccount(
  cookies: TwitterCookies,
  expectedUsername: string
): Promise<{ valid: boolean; username: string; avatar: string; error?: string }> {
  try {
    console.log('Validating account:', expectedUsername);
    console.log('Cookies:', { auth_token: cookies.auth_token.substring(0, 10) + '...', ct0: cookies.ct0.substring(0, 10) + '...' });
    
    // Use working Query ID from twscrape (Nov 2024)
    const queryId = WORKING_QUERY_IDS.UserByScreenName;
    
    console.log(`Using Query ID: ${queryId}`);
    
    const url = `https://x.com/i/api/graphql/${queryId}/UserByScreenName?variables=${encodeURIComponent(
      JSON.stringify({ 
        screen_name: expectedUsername, 
        withSafetyModeUserFields: true 
      })
    )}&features=${encodeURIComponent(
      JSON.stringify({
        hidden_profile_likes_enabled: true,
        hidden_profile_subscriptions_enabled: true,
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false,
        subscriptions_verification_info_is_identity_verified_enabled: true,
        subscriptions_verification_info_verified_since_enabled: true,
        highlights_tweets_tab_ui_enabled: true,
        responsive_web_twitter_article_notes_tab_enabled: false,
        creator_subscriptions_tweet_preview_api_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        responsive_web_graphql_timeline_navigation_enabled: true
      })
    )}`;

    const response = await fetch(url, {
      headers: {
        'authorization': `Bearer ${BEARER_TOKEN}`,
        'cookie': `auth_token=${cookies.auth_token}; ct0=${cookies.ct0}`,
        'x-csrf-token': cookies.ct0,
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-active-user': 'yes',
        'content-type': 'application/json',
      }
    });

    console.log(`Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Twitter API error:', errorText);
      return { valid: false, username: '', avatar: '', error: `HTTP ${response.status}: Invalid credentials or Query ID expired` };
    }

    const data = await response.json();
    console.log('Twitter API response:', JSON.stringify(data).substring(0, 200));
    
    const user = data?.data?.user?.result;
    
    if (!user || user.rest_id === undefined) {
      console.error('User not found in response');
      return { valid: false, username: '', avatar: '', error: 'User not found' };
    }

    const username = user.legacy?.screen_name || '';
    const avatar = user.legacy?.profile_image_url_https || '';

    console.log(`✓ Found user: ${username}`);

    if (username.toLowerCase() !== expectedUsername.toLowerCase()) {
      console.error('Username mismatch:', username, 'vs', expectedUsername);
      return { valid: false, username: '', avatar: '', error: 'Username mismatch' };
    }

    console.log('✓ Account validated successfully');
    return { valid: true, username, avatar };
    
  } catch (error) {
    console.error('Validation error:', error);
    return { valid: false, username: '', avatar: '', error: (error as Error).message };
  }
}

// البحث عن user ID
async function getUserId(username: string, cookies: TwitterCookies): Promise<string> {
  console.log('Looking up user ID for:', username);
  
  const queryId = WORKING_QUERY_IDS.UserByScreenName;
  
  const variables = {
    screen_name: username,
    withSafetyModeUserFields: true
  };
  
  const features = {
    hidden_profile_likes_enabled: true,
    hidden_profile_subscriptions_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    responsive_web_twitter_article_notes_tab_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true
  };
  
  const url = `https://x.com/i/api/graphql/${queryId}/UserByScreenName?variables=${encodeURIComponent(
    JSON.stringify(variables)
  )}&features=${encodeURIComponent(
    JSON.stringify(features)
  )}`;

  const response = await fetch(url, {
    headers: {
      'authorization': `Bearer ${BEARER_TOKEN}`,
      'cookie': `auth_token=${cookies.auth_token}; ct0=${cookies.ct0}`,
      'x-csrf-token': cookies.ct0,
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-active-user': 'yes',
      'content-type': 'application/json',
    }
  });

  console.log('getUserId response status:', response.status);

  if (!response.ok) {
    throw new Error(`Failed to get user ID: HTTP ${response.status}`);
  }

  const data = await response.json();
  const userId = data?.data?.user?.result?.rest_id;
  
  console.log('Found user ID:', userId || 'NOT FOUND');
  
  if (!userId) {
    console.error('getUserId response:', JSON.stringify(data).substring(0, 300));
    throw new Error('User not found: ' + username);
  }
  
  return userId;
}

// إرسال رسالة مباشرة (Updated to use new API endpoint)
export async function sendDM(
  encryptedCookies: string,
  recipientUsername: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cookiesStr = decrypt(encryptedCookies);
    const cookies: TwitterCookies = JSON.parse(cookiesStr);
    
    // البحث عن user ID
    const userId = await getUserId(recipientUsername, cookies);
    
    // إرسال الرسالة عبر REST API v1.1
    const response = await fetch(
      'https://x.com/i/api/1.1/dm/welcome_messages/add_to_conversation.json',
      {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${BEARER_TOKEN}`,
          'cookie': `auth_token=${cookies.auth_token}; ct0=${cookies.ct0}`,
          'x-csrf-token': cookies.ct0,
          'x-twitter-auth-type': 'OAuth2Session',
          'x-twitter-active-user': 'yes',
          'x-twitter-client-language': 'en',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'recipient_id': userId,
          'text': message,
          'cards_platform': 'Web-12',
        }).toString()
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Send DM error:', errorText);
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${errorText.substring(0, 100)}` 
      };
    }

    console.log('✓ DM sent successfully to', recipientUsername);
    return { success: true };
  } catch (error) {
    console.error('Send DM exception:', error);
    return { success: false, error: (error as Error).message };
  }
}

// استخراج المتابعين - استخدام REST API v1.1 (أكثر استقراراً)
export async function extractFollowers(
  encryptedCookies: string,
  targetUsername: string,
  count: number = 100
): Promise<Array<{ id: string; username: string; name: string; avatar: string; handle: string }>> {
  try {
    console.log('🔍 Extracting followers for:', targetUsername, 'Count:', count);
    
    const cookiesStr = decrypt(encryptedCookies);
    const cookies: TwitterCookies = JSON.parse(cookiesStr);
    
    // الحصول على user ID
    const userId = await getUserId(targetUsername, cookies);
    console.log('✓ Got user ID:', userId);
    
    const followers: any[] = [];
    let cursor: string = '-1';
    let attempts = 0;
    const maxAttempts = Math.ceil(count / 50) + 2; // عدد كافي من المحاولات
    
    while (followers.length < count && attempts < maxAttempts && cursor !== '0') {
      attempts++;
      
      // استخدام عدد عشوائي بين 50-100 لكل طلب (يبدو أكثر طبيعية)
      const randomCount = 50 + Math.floor(Math.random() * 51); // 50-100
      const requestCount = Math.min(randomCount, count - followers.length);
      
      console.log(`📥 Batch ${attempts}: Requesting ${requestCount} followers (have ${followers.length}/${count})...`);
      
      const url = `https://api.twitter.com/1.1/followers/list.json?user_id=${userId}&count=${requestCount}&cursor=${cursor}&skip_status=true&include_user_entities=false`;
      
      const response = await fetch(url, {
        headers: {
          'authorization': `Bearer ${BEARER_TOKEN}`,
          'cookie': `auth_token=${cookies.auth_token}; ct0=${cookies.ct0}`,
          'x-csrf-token': cookies.ct0,
          'x-twitter-auth-type': 'OAuth2Session',
          'x-twitter-active-user': 'yes',
        }
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText.substring(0, 300));
        
        // إذا فشل REST API، جرب GraphQL كـ fallback
        console.log('⚠️ REST API failed, trying GraphQL fallback...');
        return await extractFollowersGraphQL(cookies, userId, count);
      }
      
      const data = await response.json();
      
      if (data.users && Array.isArray(data.users)) {
        console.log(`✓ Found ${data.users.length} users in this batch`);
        
        for (const user of data.users) {
          followers.push({
            id: user.id_str,
            username: user.screen_name,
            name: user.name,
            avatar: user.profile_image_url_https || user.profile_image_url,
            handle: '@' + user.screen_name
          });
        }
        
        // الحصول على cursor للصفحة التالية
        cursor = data.next_cursor_str || '0';
        console.log(`Total followers so far: ${followers.length}, Next cursor: ${cursor}`);
      } else {
        console.log('No users found in response');
        break;
      }
      
      // تأخير عشوائي بين الطلبات (1.5-3 ثواني) - يبدو طبيعياً وآمناً
      if (followers.length < count && cursor !== '0') {
        const delay = 1500 + Math.random() * 1500; // 1.5-3 seconds
        console.log(`⏳ Waiting ${(delay / 1000).toFixed(1)}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (followers.length >= count) {
        console.log(`✅ Reached target count: ${followers.length}/${count}`);
        break;
      }
    }
    
    console.log(`✅ Extraction complete! Total followers: ${followers.length}`);
    return followers.slice(0, count);
  } catch (error) {
    console.error('❌ Error extracting followers:', error);
    return [];
  }
}

// GraphQL fallback (إذا فشل REST API) - Updated with working Query ID
async function extractFollowersGraphQL(
  cookies: TwitterCookies,
  userId: string,
  count: number
): Promise<Array<{ id: string; username: string; name: string; avatar: string; handle: string }>> {
  console.log('🔄 Using GraphQL fallback method...');
  
  const followers: Array<{ id: string; username: string; name: string; avatar: string; handle: string }> = [];
  
  // استخدام Query ID من twscrape
  const queryId = WORKING_QUERY_IDS.Followers;
  console.log(`Using GraphQL Query ID: ${queryId}`);
    
    const variables = {
      userId,
      count: Math.min(50, count),
      includePromotedContent: false
    };
    
    const features = {
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      responsive_web_graphql_timeline_navigation_enabled: true
    };
    
    const url = `https://x.com/i/api/graphql/${queryId}/Followers?variables=${encodeURIComponent(
      JSON.stringify(variables)
    )}&features=${encodeURIComponent(
      JSON.stringify(features)
    )}`;
    
  const response = await fetch(url, {
    headers: {
      'authorization': `Bearer ${BEARER_TOKEN}`,
      'cookie': `auth_token=${cookies.auth_token}; ct0=${cookies.ct0}`,
      'x-csrf-token': cookies.ct0,
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-active-user': 'yes',
    }
  });
  
  if (!response.ok) {
    console.error(`GraphQL failed with status ${response.status}`);
    return followers;
  }
  
  const data = await response.json();
  const entries = data?.data?.user?.result?.timeline?.timeline?.instructions?.find(
    (i: unknown) => i.type === 'TimelineAddEntries'
  )?.entries || [];
  
  if (entries.length > 0) {
    console.log(`✓ GraphQL works! Found ${entries.length} entries`);
    
    for (const entry of entries) {
      if (entry.entryId?.startsWith('user-')) {
        const user = entry.content?.itemContent?.user_results?.result;
        if (user && user.legacy) {
          followers.push({
            id: user.rest_id,
            username: user.legacy.screen_name,
            name: user.legacy.name,
            avatar: user.legacy.profile_image_url_https,
            handle: '@' + user.legacy.screen_name
          });
        }
      }
      
      if (followers.length >= count) break;
    }
  }
  
  console.log(`✅ GraphQL extraction complete! Total: ${followers.length}`);
  return followers.slice(0, count);
}


// متابعة مستخدم (Updated to use correct endpoint)
export async function followUser(
  encryptedCookies: string,
  targetUsername: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cookiesStr = decrypt(encryptedCookies);
    const cookies: TwitterCookies = JSON.parse(cookiesStr);
    
    // الحصول على user ID
    const userId = await getUserId(targetUsername, cookies);
    
    // متابعة المستخدم عبر REST API v1.1
    const response = await fetch(
      'https://x.com/i/api/1.1/friendships/create.json',
      {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${BEARER_TOKEN}`,
          'cookie': `auth_token=${cookies.auth_token}; ct0=${cookies.ct0}`,
          'x-csrf-token': cookies.ct0,
          'x-twitter-auth-type': 'OAuth2Session',
          'x-twitter-active-user': 'yes',
          'x-twitter-client-language': 'en',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'user_id': userId
        }).toString()
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Follow user error:', errorText);
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${errorText.substring(0, 100)}` 
      };
    }

    console.log('✓ Successfully followed', targetUsername);
    return { success: true };
  } catch (error) {
    console.error('Follow user exception:', error);
    return { success: false, error: (error as Error).message };
  }
}
