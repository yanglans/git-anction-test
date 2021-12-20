'use strict';

const fs = require('fs')
const os = require('os')
const moment = require('moment')

const scm = function createSCM(item) {
    switch (item.scm) {
      case 'github':
        return new Github(item.baseUrl, item.user, item.token);
      default:
        return new Github(item.baseUrl, item.user, item.token);
    }
}



// 获取Log文件
function getLogFile(){
    fs.readFile('log', (err, data) => {
        if (err) {
          console.error(err)
          return
        }
        writLogFile(data)
      })
}


//写入Log文件
function writLogFile(data){
    const logList = `${data} \n${moment().format('YYYY-MM-DD HH:mm:ss')} amber push `
    fs.writeFile('log',logList,function(err){
        if(err){
           return console.log('write error',err)
        }
        console.log('写入数据成功！')
    })
}

// 向mono仓库提pr
// 处理git流程
function handleGit(val) {
    const { base64Code, path, title } = val
    chrome.storage.sync.get([prTitle], (item) => {
      const pr = item[prTitle]
      if (pr) {
        const branchName = pr.branchName
        const prNumber = pr.prNumber
        const html_url = pr.html_url
        scm.checkPrState(prNumber).then(res => {
          // 如果上一个pr是打开状态并且可以合并
          if (res.state === 'open' && res.mergeable === true) {
            return scm.pushSigleFile(branchName, path, title, base64Code).then(() => {
              handleClickBtn('success', html_url)
            })
          } else {
             createMainPr(base64Code, path, title)
          }
        }).catch((err) => {
          chrome.storage.sync.remove([prTitle])
          handleGitError(err)
        })
      } else {
        createMainPr(base64Code, path, title)
      }
    })
  }
  
  function createMainPr(base64Code, path, title) {
    // 创建新的分支
     scm.createBranch(path, title).then(res => {
      // 拿到新的分支名称
      const branchName = res
      // push到新的分支
      scm.pushSigleFile(branchName, path, title, base64Code).then(() => {
        // 创建pr
        scm.createPr(branchName).then((res1) => {
          // 这里都成功了 就代表成功了
          chrome.storage.sync.set({
            [prTitle]: {
              prNumber: res1.number,
              html_url: res1.html_url,
              branchName: branchName
            },
          });
          handleClickBtn('success', res1.html_url)
        })
      })
    }).catch(handleGitError)
  }
  
  function handleGitError(err) {
    //  统一捕获git的错误
    if (+err.status === 401 || +err.status === 422) {
      // 登录失效 重新登录
      return logout()
    }
    if (err.responseJSON) {
      const { message } = err.responseJSON
      handleClickBtn('error', message)
    } else {
      handleClickBtn('error', err)
    }
  }

// 推送到git
function pushToGit() {
    const documentId = getId()
    docs.getDocData(documentId).then(handleDocs,handleDocsErr).then(handleGit)
  }



// 入口函数
function main(){
    getLogFile()
    // pushToGit()
}


main()