const { React, getModule, contextMenu, getModuleByDisplayName } = require('powercord/webpack');

const { Tooltip, Icon, Spinner } = require('powercord/components');

module.exports = class RichQuote extends React.Component {
  constructor (props) { super(props); this.state = { searchStatus: false } }

  async search () {
    const { transitionTo } = await getModule([ 'transitionTo' ]);

    const setStatus = (s) => this.setState({ ...this.state, searchStatus: s });

    // contains code by Bowser65 (Powercord's server, https://discord.com/channels/538759280057122817/539443165455974410/662376605418782730)
    function searchAPI (content, author_id, max_id, id, dm, asc) {
      return new Promise((resolve, reject) => {
        const Search = getModule(m => m.prototype && m.prototype.retryLater, false);
        const opts = { author_id, max_id, content };
        const s = new Search(id, dm ? 'DM' : 'GUILD', 
          asc ? { offset: 0, sort_by: 'timestamp', sort_order: 'asc', ...opts } : opts);
        
        s.fetch(res => resolve(res.body), () => void 0, reject);
      });
    }

    setStatus('loading');

    const result = await searchAPI(this.props.search.raw, this.props.author.id,
      this.props.search.timestamp, this.props.channel.guild_id || this.props.channel.id,
      !this.props.channel.guild_id
    );

    if (result.messages.length === 0) setStatus('error');
    else {
      const message = result.messages[0].filter((e) => e?.content.includes(this.props.search.raw))[0];

      if (!message) setStatus('error');
      else {
        setStatus('done');

        const link = [this.props.channel.guild_id || "@me", message.channel_id, message.id];

        if (this.props.cacheSearch) {
          let newCache = false;

          if (!window.localStorage.richQuoteCache) {
            window.localStorage.richQuoteCache = JSON.stringify([{ searches: [] }]);
            newCache = true;
          }

          const searchResult = { content: message.content, authorId: message.author.id, link: link };
          
          if (message.content !== this.props.search.raw) searchResult.original_content = this.props.search.raw;

          const searches = JSON.parse(window.localStorage.richQuoteCache).searches;

          window.localStorage.richQuoteCache = 
            JSON.stringify({ searches: !newCache ? [...searches, searchResult] : [searchResult]});
        }
  
        transitionTo(`/channels/${link.join('/')}`);
      }
    }

      
  }

  openPopout (event) {
    const UserPopout = getModuleByDisplayName('UserPopout', false);
    const PopoutDispatcher = getModule([ 'openPopout' ], false);
    const guildId = this.props.channel.guild_id;
    const userId = this.props.author.id;
    // modified from smart typers
    PopoutDispatcher.openPopout(event.target, {
      closeOnScroll: false,
      containerClass: 'quowoter-popout',
      render: (props) => React.createElement(UserPopout, {
        ...props,
        userId,
        guildId
      }),
      shadow: false,
      position: 'left'
    }, 'quote-user-popout');
  }

  openUserContextMenu (event) {
    const GroupDMUserContextMenu = getModuleByDisplayName('GroupDMUserContextMenu', false);
    const GuildChannelUserContextMenu = getModuleByDisplayName('GuildChannelUserContextMenu', false);
    const userStore = getModule([ 'getCurrentUser' ], false);
    const guildId = this.props.channel.guild_id;
    const userId = this.props.author.id;

    if (!guildId) {
      return contextMenu.openContextMenu(event, (props) => React.createElement(GroupDMUserContextMenu, {
        ...props,
        user: userStore.getUser(userId),
        channel: this.props.channel
      }));
    }

    contextMenu.openContextMenu(event, (props) => React.createElement(GuildChannelUserContextMenu, {
      ...props,
      user: userStore.getUser(userId),
      guildId,
      channelId: this.props.channel.id,
      showMediaItems: false,
      popoutPosition: 'top'
    }));
  }

  render () {
    const { transitionTo } = getModule([ 'transitionTo' ], false);
    const MessageTimestamp = getModule([ 'MessageTimestamp' ], false);
    const { avatar, clickable, username } = getModule([ 'systemMessageAccessories' ], false);
    const Timestamp = getModule(m => m.prototype && m.prototype.toDate && m.prototype.month, false);

    const quoteTimestamp = this.props.link ? MessageTimestamp.MessageTimestamp({
      className: "rq-timestamp",
      compact: false,
      timestamp: Timestamp(this.props.message.timestamp),
      isOnlyVisibleOnHover: false
    }) : false;

    const highlight = this.props.mentionType !== 0 ? `rq-highlight${this.props.mentionType >= 2 ? ' rq-highlight-alt' : ''}` : '';

    const highlightChannel = `rq-highlight${this.props.mentionType >= 2 ? ' rq-highlight-alt' : ''}`

    const highlightContainer = this.props.mentionType >= 2 ? `rq-highlight-container${this.props.mentionType === 3 ? ' rq-highlight-container-alt' : ''}` : '';
    
    return (
      <div id="a11y-hack"><div key={this.props.content} className='rq-inline'><div className={highlightContainer}>
        <div className='rq-header threads-header-hack'>
          <img className={`rq-avatar threads-avatar-hack revert-reply-hack ${avatar} ${clickable}`}
            src={this.props.author.avatarURL} onClick={(e) => this.openPopout(e)} 
            onContextMenu={(e) => this.openUserContextMenu(e)} aria-hidden="true" alt=" ">
          </img>
          <div className='rq-userTag'>
            <span className={`rq-username ${highlight} ${username} ${clickable}`} 
              onClick={(e) => this.openPopout(e) } onContextMenu={(e) => this.openUserContextMenu(e)}
            >{`${this.props.mentionType !== 0 ? '@' : ''}${this.props.author.username}`}</span>{
              this.props.link ? 
              <span>
                <span className='rq-infoText'>posted in </span>
                <span className={`rq-channel rq-clickable ${highlightChannel}`}
                  onClick= {() => transitionTo(`/channels/${this.props.link.slice(0,2).join('/')}`) }
                >{`#${this.props.channel.name}`}</span>
              </span>
            : false}{quoteTimestamp}
          </div>
        </div>
        {this.props.link
          ? <div className='rq-button'>
            <Tooltip position="left" text="Jump to Message"><div className='rq-clickable' 
              onClick= {() => transitionTo(`/channels/${this.props.link.join('/')}`) }><Icon className='rq-jump rq-180-flip' name="Reply"/>
            </div></Tooltip>
          </div>
          : this.state.searchStatus !== 'done' ? // this is really stupid, it should be rerendering the component (or running the link handler through an import I don't know how to do) instead. AA please fix
          <div className='rq-button'>
            <Tooltip position="left" text={
              this.state.searchStatus ? 
              this.state.searchStatus === 'error' ? 
              'Could not find matching message'
              : 'Message search loading...'
              : 'Search for Message'
            }><div key={this.state.searchStatus}
              className={this.state.searchStatus ? '' : 'rq-clickable'}
              onClick= {async () => this.state.searchStatus !== 'error' ? this.search() : false}
            >
              {this.state.searchStatus === 'loading'
                ? <Spinner className='rq-loading' type='pulsingEllipsis'/>
                : this.state.searchStatus === 'error'
                  ? <div className='rq-error'>!</div>
                  : <Icon className='rq-search' name="Search"/>
              }
            </div></Tooltip>
          </div> : false}
        <div className='rq-content'>
          {this.props.content}
          {/* this.props.accessories*/}
        </div>
      </div></div></div>
    );
  }
};
