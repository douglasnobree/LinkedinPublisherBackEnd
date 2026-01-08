import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AuthService } from '../auth.service';

@Injectable()
export class LinkedInStrategy extends PassportStrategy(Strategy, 'linkedin') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      authorizationURL: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenURL: 'https://www.linkedin.com/oauth/v2/accessToken',
      clientID: configService.get('LINKEDIN_CLIENT_ID'),
      clientSecret: configService.get('LINKEDIN_CLIENT_SECRET'),
      callbackURL: configService.get('LINKEDIN_REDIRECT_URI'),
      scope: ['openid', 'profile', 'email', 'w_member_social'],
      state: true,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done?: (error: any, user?: any) => void,
  ) {
    try {
      // With openid scope, we can use userinfo endpoint
      let linkedinId = 'linkedin-' + Date.now();
      let email = '';
      let name = 'LinkedIn User';
      let avatarUrl: string | undefined;

      try {
        // Use OpenID Connect userinfo endpoint
        const profileResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const profileData = profileResponse.data;
        linkedinId = profileData.sub || profileData.id || linkedinId;
        email = profileData.email || email;
        name = profileData.name || profileData.given_name || name;
        avatarUrl = profileData.picture;
      } catch (apiError: any) {
        // If userinfo fails, try profile API
        try {
          const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            params: {
              projection: '(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))',
            },
          });

          const data = profileResponse.data;
          linkedinId = data.id || linkedinId;
          name = `${data.localizedFirstName || ''} ${data.localizedLastName || ''}`.trim() || name;
          
          if (data.profilePicture?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier) {
            avatarUrl = data.profilePicture['displayImage~'].elements[0].identifiers[0].identifier;
          }
        } catch (profileError: any) {
          console.error('Failed to fetch LinkedIn profile:', profileError.message);
          // Use fallback values
        }
      }

      const user = await this.authService.validateOrCreateUser({
        linkedinId,
        email,
        name,
        avatarUrl,
        accessToken,
        refreshToken,
        expiresIn: 5184000, // 60 days default
      });

      if (done) {
        done(null, user);
      }
      return user;
    } catch (error: any) {
      console.error('LinkedIn OAuth validation error:', error);
      if (done) {
        done(error, null);
      }
      throw error;
    }
  }
}
