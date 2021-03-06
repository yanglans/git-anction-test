"use strict";


const moment = require("moment");
const axios = require("axios");
const Base64 = require("js-base64");
const GithubAction = require("@actions/github");
const GithubCore = require("@actions/core");
const jQuery = require("jquery");

const access_token = process.env.ACCESS_TOKEN;
const base_url = process.env.BASE_URL
const context = GithubAction.context;
const gitUrl =
  "https://api.github.com/repos/yanglans/actions-text/contents/index.json";
let prVal = {
  branchName: "",
  prNumber: "",
  html_url: "",
};
let scm

function getOrSetGitHubJSON(url, method = "GET", data = {}) {
  return axios({
    url,
    method,
    headers: {
      'Authorization': `token ${access_token}`
    },
    dataType: 'json',
    data: JSON.stringify(data),
    contentType: 'application/json'
  })
}

class Github {
  constructor(baseUrl, user, accessToken) {
    this.baseUrl = 'https://api.github.com';
    this.user = user;
    this.accessToken = accessToken;
    this.namespaces = [user];
    this.prRepo = "actions-text";
    this.mainRef = "heads/master";
  }

  // 检查是否存在文档地址
  checkDocsPath = (path) => {
    return getOrSetGitHubJSON(
      `${this.baseUrl}/repos/${this.prRepo}/contents/${path}`
    );
  };
  // 获取mono里面的master分支的sha
  getMonoMasterSha = () => {
    return getOrSetGitHubJSON(
      `${this.baseUrl}/repos/${this.prRepo}/git/ref/${this.mainRef}`
    );
  };
  // 获取具体替换文件的sha
  getFileSha = (path, branch) => {
    return getOrSetGitHubJSON(
      `${this.baseUrl}/repos/${getRepo()}/contents/${path}?ref=${branch}`
    );
  };

  // 检查pr状态
  checkPrState = (prNumber) => {
    return getOrSetGitHubJSON(
      `${this.baseUrl}/repos/${this.prRepo}/pulls/${prNumber}`
    );
  };

  createBranch = (path) => {
    return new Promise((resolve, reject) => {
      // 先检查是否存在文档地址
      // 获取mono里面的master分支的sha
      this.checkDocsPath(path)
        .then(this.getMonoMasterSha)
        .then((res) => {
          const sha = res.object.sha;
          const branch = "googleDocsToGit" + new Date().getTime();
          const payload = {
            ref: `refs/heads/${branch}`,
            sha: sha,
          };
          // 创建新的分支
          getOrSetGitHubJSON(
            `${this.baseUrl}/repos/${getRepo()}/git/refs`,
            "POST",
            payload
          ).then(
            () => {
              resolve(branch);
            },
            (err) => {
              // 这里是捕获创建分支的错误
              reject(err);
            }
          );
        })
        .catch((err) => {
          // 这里是捕获 检查文档路径 获取sha的错误
          reject(err);
        });
    });
  };

  // 创建pr
  createPr = (branch) => {
    const payload = {
      title: `feat: Synchronize documents from Google docs to git`,
      head: `${this.user}:${branch}`,
      base: "master",
    };
    // 创建新的pr
    return getOrSetGitHubJSON(
      `${this.baseUrl}/repos/${this.prRepo}/pulls`,
      "POST",
      payload
    );
  };
  // 推送文件到git仓库
  pushSigleFile = (branch, path, code) => {
    return this.getFileSha(path, branch).then((res) => {
      const payload = {
        message: `feat: new message changed`,
        content: code,
        sha: res.sha,
        branch: branch,
      };
      return getOrSetGitHubJSON(gitUrl, "PUT", payload);
    });
  };
}

function createSCM() {
  scm = new Github(gitUrl, context.payload.pusher.name, access_token);
}

// 获取Log文件
function getLogFile() {
  jQuery.$.ajax({
    url:`${base_url}/repos/mono/mono/contents/web/apps/docs-summary-ui/log/index.json?ref=master`,
    method:'GET',
    headers: {
            Authorization: `token ${access_token}`,
          },
    crossDomain: true,
    dataType: 'json',
    contentType: 'application/json'
  }).then((response) => {
    const data = JSON.parse(Base64.decode(response.data.content));
    data.log.push({
      time: moment().format("YYYY-MM-DD HH:mm:ss"),
      user: context.payload.pusher.name,
      action: context.eventName,
      html_url: context.payload.repository.html_url,
    });
    console.log(data)
    // handleGit({
    //   base64Code: data,
    //   path: 'index.json',
    // });
  })
  .catch((err) => {
    console.log("失败111");
    console.log(err)
  });
}

    

// 向主仓库提pr
// 处理git流程
function handleGit(val) {
  const { base64Code, path } = val;
  const { branchName, prNumber } = prVal;
  if (prNumber) {
    scm
      .checkPrState(prNumber)
      .then((res) => {
        // 如果上一个pr是打开状态并且可以合并
        if (res.state === "open" && res.mergeable === true) {
          console.log("失败222");
          return scm.pushSigleFile(branchName, path, base64Code).then(() => {
            console.log("推送成功");
          });
        } else {
          createMainPr(base64Code, path);
        }
      })
      .catch((err) => {
        localStorage.removeItem("prTitle");
      });
  } else {
    createMainPr(base64Code, path);
  }
}

function createMainPr(base64Code, path) {
  console.log("失败333");
  // 创建新的分支
  scm
    .createBranch(path)
    .then((res) => {
      // 拿到新的分支名称
      const branchName = res;
      // push到新的分支
      scm.pushSigleFile(branchName, path, base64Code).then(() => {
        // 创建pr
        scm.createPr(branchName).then((res1) => {
          // 这里都成功了 就代表成功了
          prVal = {
            ...prVal,
            prNumber: res1.number,
            html_url: res1.html_url,
            branchName: branchName,
          };
        });
      });
    })
    .catch((err) => {
      console.log('这里失败了',err);
    });
}

// 入口函数
function main() {
  createSCM();
  getLogFile();
}

main();
